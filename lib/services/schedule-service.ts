import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { parseAmountToCents } from "@/lib/utils";
import { scheduleInputSchema } from "@/lib/validators/schedule";
import { addInterval, classifyScheduleStatus } from "@/lib/date";
import { createTransaction } from "@/lib/services/transaction-service";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { getTrackerById } from "@/lib/trackers";

export async function listSchedules(trackerId: string, status?: string) {
  const base = await db
    .select()
    .from(schedules)
    .where(eq(schedules.trackerId, trackerId))
    .orderBy(asc(schedules.nextDueDate));

  return base.filter((schedule) => {
    if (status === "inactive") return !schedule.isActive;
    if (!schedule.isActive) return false;
    const current = classifyScheduleStatus(schedule.nextDueDate);
    if (status === "due") return current === "due" || current === "overdue";
    if (status === "upcoming") return current === "upcoming";
    return true;
  });
}

export async function createSchedule(input: unknown, actorUserId: string) {
  const parsed = scheduleInputSchema.parse(input);
  const amountCents = parseAmountToCents(parsed.amount);
  if (amountCents === null || amountCents <= 0) {
    throw new Error("Invalid schedule amount");
  }

  const tracker = await getTrackerById(parsed.trackerId);
  if (!tracker) {
    throw new Error("Tracker not found");
  }
  if (!tracker.isActive) {
    throw new Error("Tracker is archived and cannot be modified");
  }

  const [created] = await db
    .insert(schedules)
    .values({
      trackerId: parsed.trackerId,
      name: parsed.name,
      amountCents,
      direction: parsed.direction,
      categoryId: parsed.categoryId ?? null,
      payeeId: parsed.payeeId ?? null,
      customPayeeName: parsed.customPayeeName ?? null,
      notesTemplate: parsed.notesTemplate ?? null,
      frequency: parsed.frequency,
      intervalValue: parsed.intervalValue,
      nextDueDate: parsed.nextDueDate,
      isActive: parsed.isActive ?? true,
      autoCreateDisabled: parsed.autoCreateDisabled ?? true,
      createdByUserId: actorUserId,
    })
    .returning();

  await logAuditEvent({
    actorUserId,
    action: "schedule_created",
    resourceType: "schedule",
    resourceId: created.id,
    metadata: created,
    ...(await getRequestAuditContext()),
  });

  return created;
}

export async function createTransactionFromSchedule(
  scheduleId: string,
  actorUserId: string
) {
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId))
    .limit(1);
  const schedule = rows[0];
  if (!schedule) {
    throw new Error("Schedule not found");
  }

  const transaction = await createTransaction(
    {
      trackerId: schedule.trackerId,
      date: schedule.nextDueDate,
      amount: schedule.amountCents / 100,
      direction: schedule.direction,
      categoryId: schedule.categoryId,
      payeeId: schedule.payeeId,
      customPayeeName: schedule.customPayeeName,
      notes: schedule.notesTemplate,
      source: "schedule",
      scheduleId: schedule.id,
    },
    actorUserId
  );

  const nextDueDate = addInterval(
    schedule.nextDueDate,
    schedule.frequency,
    schedule.intervalValue
  );

  await db
    .update(schedules)
    .set({
      lastCompletedDate: schedule.nextDueDate,
      nextDueDate,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, schedule.id));

  await logAuditEvent({
    actorUserId,
    action: "schedule_transaction_created",
    resourceType: "schedule",
    resourceId: schedule.id,
    metadata: { transactionId: transaction.id, nextDueDate },
    ...(await getRequestAuditContext()),
  });

  return transaction;
}
