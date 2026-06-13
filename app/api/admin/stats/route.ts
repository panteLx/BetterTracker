import { count, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { schedules, trackers, transactions, user } from "@/lib/db/schema";
import { ok, serverError } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const [userCount] = await db.select({ value: count() }).from(user);
    const [trackerCount] = await db.select({ value: count() }).from(trackers);
    const [transactionCount] = await db.select({ value: count() }).from(transactions);
    const [scheduleCount] = await db.select({ value: count() }).from(schedules);
    const [totals] = await db.select({
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    }).from(transactions);

    return ok({
      users: userCount.value,
      trackers: trackerCount.value,
      transactions: transactionCount.value,
      schedules: scheduleCount.value,
      totals,
    });
  } catch (error) {
    return serverError(error);
  }
}
