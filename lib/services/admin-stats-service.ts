import { count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules, trackers, transactions, user } from "@/lib/db/schema";

export async function getAdminStats() {
  const [userCount] = await db.select({ value: count() }).from(user);
  const [trackerCount] = await db.select({ value: count() }).from(trackers);
  const [transactionCount] = await db.select({ value: count() }).from(transactions);
  const [scheduleCount] = await db.select({ value: count() }).from(schedules);
  const [totals] = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions);

  return {
    users: userCount.value,
    trackers: trackerCount.value,
    transactions: transactionCount.value,
    schedules: scheduleCount.value,
    totals,
  };
}
