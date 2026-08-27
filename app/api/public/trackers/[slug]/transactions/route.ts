import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, payees, trackers, transactions } from "@/lib/db/schema";
import { notFound, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  // Unauthenticated, so there is no user id to key on — the tracker being read
  // is the next best bucket, and it is what the query actually costs.
  const limited = checkRateLimit(`public-transactions:${slug}`, 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const limit = parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parsePositiveInt(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);

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
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  const totalsRows = await db
    .select({
      total: sql<number>`count(*)`,
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.trackerId, tracker.id));

  const { total, ...totals } = totalsRows[0] ?? {
    total: 0,
    incomeCents: 0,
    expenseCents: 0,
  };

  return ok({ items, totals, page: { limit, offset, total } });
}
