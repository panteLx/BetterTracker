import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, payees, trackers, transactions } from "@/lib/db/schema";
import { notFound, ok } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  const trackerRows = await db
    .select({ id: trackers.id, currency: trackers.currency })
    .from(trackers)
    .where(and(eq(trackers.slug, slug), eq(trackers.isPublic, true), eq(trackers.isHidden, false)))
    .limit(1);

  const tracker = trackerRows[0];
  if (!tracker) return notFound("Tracker not found or not public");

  const items = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amountCents: transactions.amountCents,
      direction: transactions.direction,
      categoryName: categories.name,
      payeeName: payees.name,
      customPayeeName: transactions.customPayeeName,
      notes: transactions.notes,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(payees, eq(payees.id, transactions.payeeId))
    .where(eq(transactions.trackerId, tracker.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  const totalsRows = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.trackerId, tracker.id));

  const totals = totalsRows[0] ?? { incomeCents: 0, expenseCents: 0 };

  return ok({ items, totals });
}
