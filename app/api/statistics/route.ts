import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { requireTrackerReadAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { categories, payees, transactions } from "@/lib/db/schema";
import { badRequest, ok, serverError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

async function queryCategoryBreakdown(
  trackerId: string,
  from: string,
  to: string,
  direction: "expense" | "income"
) {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: sql<string>`coalesce(${categories.name}, 'Ohne Kategorie')`,
      color: sql<string>`coalesce(${categories.color}, '#0f766e')`,
      totalCents: sql<number>`sum(${transactions.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.trackerId, trackerId),
        gte(transactions.date, from),
        lte(transactions.date, to),
        eq(transactions.direction, direction)
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(sql`sum(${transactions.amountCents}) desc`)
    .limit(8);

  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  return rows.map((r) => ({
    ...r,
    percentage: total > 0 ? Math.round((r.totalCents / total) * 1000) / 10 : 0,
  }));
}

async function queryTopPayees(
  trackerId: string,
  from: string,
  to: string,
  direction: "expense" | "income"
) {
  return db
    .select({
      payeeId: transactions.payeeId,
      payeeName: sql<string>`coalesce(${payees.name}, ${transactions.customPayeeName}, 'Unbekannt')`,
      totalCents: sql<number>`sum(${transactions.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(payees, eq(payees.id, transactions.payeeId))
    .where(
      and(
        eq(transactions.trackerId, trackerId),
        gte(transactions.date, from),
        lte(transactions.date, to),
        eq(transactions.direction, direction)
      )
    )
    .groupBy(transactions.payeeId)
    .orderBy(sql`sum(${transactions.amountCents}) desc`)
    .limit(8);
}

async function querySummary(trackerId: string, from: string, to: string) {
  const [row] = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
      transactionCount: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.trackerId, trackerId),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    );

  return {
    incomeCents: row?.incomeCents ?? 0,
    expenseCents: row?.expenseCents ?? 0,
    balanceCents: (row?.incomeCents ?? 0) - (row?.expenseCents ?? 0),
    transactionCount: row?.transactionCount ?? 0,
  };
}

/** SQLite's strftime('%w', …) is 0=Sunday…6=Saturday; we re-key to a Monday-first index (0=Mon…6=Sun). */
const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

async function queryWeekdayBreakdown(trackerId: string, from: string, to: string) {
  const rows = await db
    .select({
      weekday: sql<number>`cast(strftime('%w', ${transactions.date}) as integer)`,
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.trackerId, trackerId),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .groupBy(sql`strftime('%w', ${transactions.date})`);

  const byWeekday = new Map(rows.map((r) => [r.weekday, r]));
  return Array.from({ length: 7 }, (_, mondayFirstIndex) => {
    const sqliteWeekday = (mondayFirstIndex + 1) % 7;
    const row = byWeekday.get(sqliteWeekday);
    return {
      weekday: WEEKDAY_NAMES[mondayFirstIndex],
      incomeCents: row?.incomeCents ?? 0,
      expenseCents: row?.expenseCents ?? 0,
    };
  });
}

async function queryWeightTotal(trackerId: string, from: string, to: string) {
  const [row] = await db
    .select({
      totalGrams: sql<number>`coalesce(sum(${transactions.weightGrams}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.trackerId, trackerId),
        gte(transactions.date, from),
        lte(transactions.date, to),
        sql`${transactions.weightGrams} is not null`
      )
    );

  return row?.totalGrams ?? 0;
}

async function queryWeightByPayee(trackerId: string, from: string, to: string) {
  return db
    .select({
      payeeId: transactions.payeeId,
      payeeName: sql<string>`coalesce(${payees.name}, ${transactions.customPayeeName}, 'Unbekannt')`,
      totalGrams: sql<number>`sum(${transactions.weightGrams})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(payees, eq(payees.id, transactions.payeeId))
    .where(
      and(
        eq(transactions.trackerId, trackerId),
        gte(transactions.date, from),
        lte(transactions.date, to),
        sql`${transactions.weightGrams} is not null`
      )
    )
    .groupBy(transactions.payeeId)
    .orderBy(sql`sum(${transactions.weightGrams}) desc`)
    .limit(8);
}

async function queryTopExpense(trackerId: string, from: string, to: string) {
  const [row] = await db
    .select({
      amountCents: transactions.amountCents,
      date: transactions.date,
      payeeName: sql<string>`coalesce(${payees.name}, ${transactions.customPayeeName}, 'Unbekannt')`,
      categoryName: sql<string>`coalesce(${categories.name}, 'Ohne Kategorie')`,
    })
    .from(transactions)
    .leftJoin(payees, eq(payees.id, transactions.payeeId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.trackerId, trackerId),
        gte(transactions.date, from),
        lte(transactions.date, to),
        eq(transactions.direction, "expense")
      )
    )
    .orderBy(sql`${transactions.amountCents} desc`)
    .limit(1);

  return row ?? null;
}

export async function GET(request: Request) {
  const t = await getTranslations("Errors");
  const { searchParams } = new URL(request.url);
  const trackerId = searchParams.get("trackerId");
  if (!trackerId) return badRequest("trackerId is required");

  const access = await requireTrackerReadAccess(request.headers, trackerId);
  if (access.response) return access.response;

  // Ten aggregate queries per request against a single-writer database.
  const limited = checkRateLimit(`statistics:${access.user!.id}`, 60, 60_000);
  if (limited) return limited;

  const rawYear = searchParams.get("year");
  const year = parseInt(rawYear || String(new Date().getFullYear()));
  if (isNaN(year) || year < 2000 || year > 2100)
    return badRequest(t("api.invalidYear"));

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  try {
    const baseFilters = [
      eq(transactions.trackerId, trackerId),
      gte(transactions.date, from),
      lte(transactions.date, to),
    ];

    const [summaryRow] = await db
      .select({
        incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
        expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(and(...baseFilters));

    const monthlyRows = await db
      .select({
        month: sql<string>`substr(${transactions.date}, 1, 7)`,
        incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
        expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(and(...baseFilters))
      .groupBy(sql`substr(${transactions.date}, 1, 7)`)
      .orderBy(sql`substr(${transactions.date}, 1, 7)`);

    const monthlyMap = new Map(monthlyRows.map((r) => [r.month, r]));
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${year}-${String(i + 1).padStart(2, "0")}`;
      const row = monthlyMap.get(monthStr);
      return {
        month: monthStr,
        incomeCents: row?.incomeCents ?? 0,
        expenseCents: row?.expenseCents ?? 0,
        transactionCount: row?.transactionCount ?? 0,
      };
    });

    const [baseRow] = await db
      .select({
        balanceCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else -${transactions.amountCents} end), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.trackerId, trackerId), lt(transactions.date, from)));

    let runningBalance = baseRow?.balanceCents ?? 0;
    const balanceTrend = monthly.map((m) => {
      runningBalance += m.incomeCents - m.expenseCents;
      return { month: m.month, balanceCents: runningBalance };
    });

    const previousYearFrom = `${year - 1}-01-01`;
    const previousYearTo = `${year - 1}-12-31`;

    const weightTrackingEnabled = access.trackerAccess!.tracker.weightTrackingEnabled;

    const [
      categoryExpense,
      categoryIncome,
      payeesExpense,
      payeesIncome,
      previousYear,
      weekday,
      topExpense,
      weightTotal,
      weightPreviousYearTotal,
      weightByPayee,
    ] = await Promise.all([
      queryCategoryBreakdown(trackerId, from, to, "expense"),
      queryCategoryBreakdown(trackerId, from, to, "income"),
      queryTopPayees(trackerId, from, to, "expense"),
      queryTopPayees(trackerId, from, to, "income"),
      querySummary(trackerId, previousYearFrom, previousYearTo),
      queryWeekdayBreakdown(trackerId, from, to),
      queryTopExpense(trackerId, from, to),
      weightTrackingEnabled
        ? queryWeightTotal(trackerId, from, to)
        : Promise.resolve(0),
      weightTrackingEnabled
        ? queryWeightTotal(trackerId, previousYearFrom, previousYearTo)
        : Promise.resolve(0),
      weightTrackingEnabled
        ? queryWeightByPayee(trackerId, from, to)
        : Promise.resolve([]),
    ]);

    return ok({
      year,
      summary: {
        incomeCents: summaryRow?.incomeCents ?? 0,
        expenseCents: summaryRow?.expenseCents ?? 0,
        balanceCents:
          (summaryRow?.incomeCents ?? 0) - (summaryRow?.expenseCents ?? 0),
        transactionCount: summaryRow?.transactionCount ?? 0,
      },
      previousYear,
      monthly,
      categories: { expense: categoryExpense, income: categoryIncome },
      payees: { expense: payeesExpense, income: payeesIncome },
      balanceTrend,
      weekday,
      topExpense,
      weight: {
        totalGrams: weightTotal,
        previousYearTotalGrams: weightPreviousYearTotal,
        byPayee: weightByPayee,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
