import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { canMutateTrackerResource, type TrackerPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { categories, payees, trackers, transactions } from "@/lib/db/schema";
import { parseAmountToCents } from "@/lib/utils";
import { transactionInputSchema, transactionQuerySchema } from "@/lib/validators/transaction";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { sendDiscordNotification } from "@/lib/services/discord-service";
import { getTrackerById } from "@/lib/trackers";

export async function listTransactions(
  query: unknown,
  actorUserId: string,
  permission: TrackerPermission
) {
  const parsed = transactionQuerySchema.parse(query);
  const filters = [eq(transactions.trackerId, parsed.trackerId)];

  if (parsed.from) filters.push(gte(transactions.date, parsed.from));
  if (parsed.to) filters.push(lte(transactions.date, parsed.to));
  if (parsed.categoryId) filters.push(eq(transactions.categoryId, parsed.categoryId));
  if (parsed.payeeId) filters.push(eq(transactions.payeeId, parsed.payeeId));
  if (parsed.direction) filters.push(eq(transactions.direction, parsed.direction));
  if (parsed.q) {
    const searchTerm = `%${parsed.q.trim()}%`;
    filters.push(
      or(
        like(transactions.notes, searchTerm),
        like(transactions.customPayeeName, searchTerm),
        like(payees.name, searchTerm),
        like(categories.name, searchTerm),
        like(transactions.accountName, searchTerm)
      )!
    );
  }

  const rows = await db
    .select({
      id: transactions.id,
      trackerId: transactions.trackerId,
      accountName: transactions.accountName,
      date: transactions.date,
      amountCents: transactions.amountCents,
      direction: transactions.direction,
      categoryId: transactions.categoryId,
      payeeId: transactions.payeeId,
      notes: transactions.notes,
      source: transactions.source,
      createdByUserId: transactions.createdByUserId,
      categoryName: categories.name,
      payeeName: payees.name,
      customPayeeName: transactions.customPayeeName,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(payees, eq(payees.id, transactions.payeeId))
    .where(and(...filters))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  const items = rows.map((row) => ({
    ...row,
    canEdit: canMutateTrackerResource(permission, actorUserId, row.createdByUserId),
    canDelete: canMutateTrackerResource(permission, actorUserId, row.createdByUserId),
  }));

  const totals = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(payees, eq(payees.id, transactions.payeeId))
    .where(and(...filters));

  return {
    items,
    totals: totals[0] ?? { incomeCents: 0, expenseCents: 0 },
  };
}

export async function createTransaction(input: unknown, actorUserId: string) {
  const parsed = transactionInputSchema.parse(input);
  const amountCents = parseAmountToCents(parsed.amount);
  if (amountCents === null || amountCents <= 0) {
    throw new Error("Invalid transaction amount");
  }

  const tracker = await getTrackerById(parsed.trackerId);
  if (!tracker) {
    throw new Error("Tracker not found");
  }
  if (!tracker.isActive) {
    throw new Error("Tracker is archived and cannot be modified");
  }

  const [category] = await db
    .select({
      id: categories.id,
      type: categories.type,
    })
    .from(categories)
    .where(
      and(
        eq(categories.id, parsed.categoryId),
        eq(categories.trackerId, parsed.trackerId)
      )
    )
    .limit(1);

  if (!category) {
    throw new Error("Transaction category is required");
  }

  if (category.type !== parsed.direction && category.type !== "transfer") {
    throw new Error("Transaction category does not match the selected direction");
  }

  let resolvedPayeeId = parsed.payeeId ?? null;
  const trimmedCustomPayeeName = parsed.customPayeeName?.trim();
  let resolvedAccountName = parsed.accountName?.trim() || "";

  if (!resolvedAccountName) {
    const [trackerRow] = await db
      .select({ name: trackers.name })
      .from(trackers)
      .where(eq(trackers.id, parsed.trackerId))
      .limit(1);

    resolvedAccountName = trackerRow?.name || "Tracker";
  }

  if (!resolvedPayeeId && trimmedCustomPayeeName) {
    const [existingPayee] = await db
      .select({ id: payees.id })
      .from(payees)
      .where(
        and(
          eq(payees.trackerId, parsed.trackerId),
          eq(payees.name, trimmedCustomPayeeName)
        )
      )
      .limit(1);

    if (existingPayee) {
      resolvedPayeeId = existingPayee.id;
    } else {
      const [createdPayee] = await db
        .insert(payees)
        .values({
          trackerId: parsed.trackerId,
          name: trimmedCustomPayeeName,
        })
        .returning({ id: payees.id });

      resolvedPayeeId = createdPayee.id;
    }
  }

  const [created] = await db
    .insert(transactions)
    .values({
      trackerId: parsed.trackerId,
      accountName: resolvedAccountName,
      date: parsed.date,
      amountCents,
      direction: parsed.direction,
      categoryId: parsed.categoryId ?? null,
      payeeId: resolvedPayeeId,
      customPayeeName: null,
      notes: parsed.notes ?? null,
      source: parsed.source,
      scheduleId: parsed.scheduleId ?? null,
      createdByUserId: actorUserId,
    })
    .returning();

  const auditContext = await getRequestAuditContext();
  await logAuditEvent({
    actorUserId,
    action: "transaction_created",
    resourceType: "transaction",
    resourceId: created.id,
    metadata: {
      trackerId: parsed.trackerId,
      amountCents,
      direction: parsed.direction,
    },
    ...auditContext,
  });

  await sendDiscordNotification({
    type: "transaction_created",
    trackerId: parsed.trackerId,
    title: "Neue Transaktion",
    description: `Eine ${parsed.direction === "expense" ? "Ausgabe" : "Einnahme"} wurde erfasst.`,
    createdByUserId: actorUserId,
    includeDebug: true,
    debugPayload: created,
    fields: [
      { name: "Datum", value: parsed.date, inline: true },
      { name: "Betrag", value: `${amountCents / 100} EUR`, inline: true },
      { name: "Konto", value: resolvedAccountName, inline: true },
    ],
  });

  return created;
}
