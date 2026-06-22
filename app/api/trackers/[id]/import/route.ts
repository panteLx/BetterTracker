import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, payees, transactions } from "@/lib/db/schema";
import { requireTrackerManageAccess } from "@/lib/auth/guards";
import { badRequest, created, serverError } from "@/lib/http";

type ImportRow = {
  date: string;
  amount: string;
  account: string;
  payee: string;
  notes: string;
  category: string;
};

type ImportColumns = {
  account: boolean;
  payee: boolean;
  notes: boolean;
  category: boolean;
};

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: trackerId } = await context.params;

  const access = await requireTrackerManageAccess(request.headers, trackerId);
  if (access.response) return access.response;

  if (!access.trackerAccess?.tracker.isActive) {
    return NextResponse.json(
      { error: "Tracker ist archiviert und kann nicht bearbeitet werden" },
      { status: 409 },
    );
  }

  let body: { rows?: unknown; columns?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Ungültiger JSON-Body");
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return badRequest("rows ist erforderlich und darf nicht leer sein");
  }

  const rows = body.rows as ImportRow[];
  const cols: ImportColumns = {
    account: true,
    payee: true,
    notes: true,
    category: true,
    ...((body.columns as Partial<ImportColumns>) || {}),
  };

  // Determine category type by majority of amounts per category name
  const categoryAmounts = new Map<string, number[]>();
  if (cols.category) {
    for (const row of rows) {
      const catName = row.category?.trim();
      if (!catName) continue;
      const raw = parseFloat(row.amount?.replace(",", ".") ?? "");
      if (isNaN(raw)) continue;
      if (!categoryAmounts.has(catName)) categoryAmounts.set(catName, []);
      categoryAmounts.get(catName)!.push(raw);
    }
  }

  // Find or create categories
  const categoryIdMap = new Map<string, string>();
  let newCategoryCount = 0;

  try {
    for (const [catName, amounts] of categoryAmounts) {
      const negCount = amounts.filter((a) => a < 0).length;
      const posCount = amounts.filter((a) => a >= 0).length;
      const catType: "expense" | "income" = negCount > posCount ? "expense" : "income";

      const [existing] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.trackerId, trackerId), eq(categories.name, catName)))
        .limit(1);

      if (existing) {
        categoryIdMap.set(catName, existing.id);
      } else {
        const [inserted] = await db
          .insert(categories)
          .values({ trackerId, name: catName, type: catType, color: "#475569" })
          .returning({ id: categories.id });
        categoryIdMap.set(catName, inserted.id);
        newCategoryCount++;
      }
    }
  } catch (err) {
    return serverError(err);
  }

  // Find or create payees
  const payeeIdMap = new Map<string, string>();
  let newPayeeCount = 0;

  if (cols.payee) {
    const uniquePayeeNames = [
      ...new Set(
        rows.map((r) => r.payee?.trim()).filter((n): n is string => Boolean(n)),
      ),
    ];

    try {
      for (const payeeName of uniquePayeeNames) {
        const [existing] = await db
          .select({ id: payees.id })
          .from(payees)
          .where(and(eq(payees.trackerId, trackerId), eq(payees.name, payeeName)))
          .limit(1);

        if (existing) {
          payeeIdMap.set(payeeName, existing.id);
        } else {
          const [inserted] = await db
            .insert(payees)
            .values({ trackerId, name: payeeName })
            .returning({ id: payees.id });
          payeeIdMap.set(payeeName, inserted.id);
          newPayeeCount++;
        }
      }
    } catch (err) {
      return serverError(err);
    }
  }

  // Import transactions
  let transactionCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const amountStr = row.amount?.replace(",", ".").trim();
      if (!amountStr) {
        errors.push(`Zeile ${rowNum}: Kein Betrag`);
        continue;
      }

      const rawAmount = parseFloat(amountStr);
      if (isNaN(rawAmount) || rawAmount === 0) {
        errors.push(`Zeile ${rowNum}: Ungültiger Betrag "${row.amount}"`);
        continue;
      }

      const date = normalizeDate(row.date ?? "");
      if (!date) {
        errors.push(`Zeile ${rowNum}: Ungültiges Datum "${row.date}"`);
        continue;
      }

      const direction: "expense" | "income" = rawAmount < 0 ? "expense" : "income";
      const amountCents = Math.round(Math.abs(rawAmount) * 100);

      const catName = cols.category ? row.category?.trim() : undefined;
      const categoryId = catName ? (categoryIdMap.get(catName) ?? null) : null;

      if (!categoryId) {
        errors.push(
          `Zeile ${rowNum}: Keine Kategorie${catName ? ` "${catName}"` : ""}`,
        );
        continue;
      }

      const payeeName = cols.payee ? row.payee?.trim() : undefined;
      const payeeId = payeeName ? (payeeIdMap.get(payeeName) ?? null) : null;

      const accountName =
        cols.account && row.account?.trim() ? row.account.trim() : "";
      const notes = cols.notes && row.notes?.trim() ? row.notes.trim() : null;

      await db.insert(transactions).values({
        trackerId,
        accountName,
        date,
        amountCents,
        direction,
        categoryId,
        payeeId,
        customPayeeName: null,
        notes,
        source: "manual",
        scheduleId: null,
        createdByUserId: access.user!.id,
      });

      transactionCount++;
    } catch (err) {
      errors.push(
        `Zeile ${rowNum}: ${err instanceof Error ? err.message : "Fehler"}`,
      );
    }
  }

  return created({
    result: {
      transactions: transactionCount,
      categories: newCategoryCount,
      payees: newPayeeCount,
      errors,
    },
  });
}
