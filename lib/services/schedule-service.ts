import { and, asc, eq, sql } from "drizzle-orm";
import { canMutateTrackerResource, canWriteTracker, type TrackerPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { categories, payees, schedules, transactions } from "@/lib/db/schema";
import { addInterval, classifyScheduleStatus } from "@/lib/date";
import { parseAmountToCents, toDateInputValue } from "@/lib/utils";
import { scheduleInputSchema, scheduleUpdateSchema } from "@/lib/validators/schedule";
import { createTransaction } from "@/lib/services/transaction-service";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { getTrackerById } from "@/lib/trackers";

export type ScheduleStatus = "overdue" | "due" | "upcoming" | "completed" | "incomplete";

type ScheduleRow = {
  id: string;
  trackerId: string;
  name: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryId: string | null;
  payeeId: string | null;
  notesTemplate: string | null;
  frequency: "monthly" | "yearly" | "custom_days";
  intervalValue: number;
  nextDueDate: string;
  lastCompletedDate: string | null;
  isActive: boolean;
  createdByUserId: string;
  categoryName: string | null;
  payeeName: string | null;
};

type HydratedSchedule = Omit<ScheduleRow, "categoryName" | "payeeName"> & {
  categoryName: string | null;
  payeeName: string | null;
  status: ScheduleStatus;
  timingStatus: "overdue" | "due" | "upcoming";
  isComplete: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreateTransaction: boolean;
};

type ScheduleForecastItem = {
  scheduleId: string;
  occurrenceKey: string;
  name: string;
  payeeName: string;
  categoryName: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  status: "overdue" | "due" | "upcoming";
};

function clampForecastDays(days: number) {
  return Math.min(Math.max(days, 1), 365);
}

function getScheduleStatus(
  schedule: Pick<ScheduleRow, "isActive" | "nextDueDate" | "categoryId" | "payeeId" | "categoryName" | "payeeName">
): ScheduleStatus {
  if (!schedule.isActive) {
    return "completed";
  }

  if (!schedule.categoryId || !schedule.payeeId || !schedule.categoryName || !schedule.payeeName) {
    return "incomplete";
  }

  return classifyScheduleStatus(schedule.nextDueDate);
}

async function getScheduleRows(trackerId: string) {
  return db
    .select({
      id: schedules.id,
      trackerId: schedules.trackerId,
      name: schedules.name,
      amountCents: schedules.amountCents,
      direction: schedules.direction,
      categoryId: schedules.categoryId,
      payeeId: schedules.payeeId,
      notesTemplate: schedules.notesTemplate,
      frequency: schedules.frequency,
      intervalValue: schedules.intervalValue,
      nextDueDate: schedules.nextDueDate,
      lastCompletedDate: schedules.lastCompletedDate,
      isActive: schedules.isActive,
      createdByUserId: schedules.createdByUserId,
      categoryName: categories.name,
      payeeName: payees.name,
    })
    .from(schedules)
    .leftJoin(categories, eq(categories.id, schedules.categoryId))
    .leftJoin(payees, eq(payees.id, schedules.payeeId))
    .where(eq(schedules.trackerId, trackerId))
    .orderBy(asc(schedules.nextDueDate), asc(schedules.name));
}

async function validateScheduleReferences(
  trackerId: string,
  direction: "expense" | "income",
  categoryId: string | null,
  payeeId: string | null
) {
  if (!categoryId || !payeeId) {
    return;
  }

  const [category] = await db
    .select({
      id: categories.id,
      type: categories.type,
    })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.trackerId, trackerId)))
    .limit(1);

  if (!category) {
    throw new Error("Schedule category not found in tracker");
  }

  if (category.type !== direction && category.type !== "transfer") {
    throw new Error("Schedule category does not match the selected direction");
  }

  const [payee] = await db
    .select({ id: payees.id })
    .from(payees)
    .where(and(eq(payees.id, payeeId), eq(payees.trackerId, trackerId)))
    .limit(1);

  if (!payee) {
    throw new Error("Schedule payee not found in tracker");
  }
}

function hydrateSchedule(
  schedule: ScheduleRow,
  actorUserId: string,
  permission: TrackerPermission
): HydratedSchedule {
  const timingStatus = classifyScheduleStatus(schedule.nextDueDate);
  const isComplete = Boolean(
    schedule.categoryId &&
      schedule.payeeId &&
      schedule.categoryName &&
      schedule.payeeName
  );
  const canMutate = canMutateTrackerResource(permission, actorUserId, schedule.createdByUserId);

  return {
    ...schedule,
    status: getScheduleStatus(schedule),
    timingStatus,
    isComplete,
    canEdit: canMutate,
    canDelete: canMutate,
    // Booking creates a new transaction — any write+ member may book any active schedule,
    // regardless of who created it.
    canCreateTransaction: canWriteTracker(permission) && schedule.isActive && isComplete,
  };
}

export async function listSchedules(
  trackerId: string,
  status: string | undefined,
  actorUserId: string,
  permission: TrackerPermission
) {
  const rows = await getScheduleRows(trackerId);

  return rows
    .map((schedule) => hydrateSchedule(schedule, actorUserId, permission))
    .filter((schedule) => {
      if (status === "inactive" || status === "completed") {
        return !schedule.isActive;
      }

      if (!schedule.isActive) {
        return false;
      }

      if (status === "due") {
        return schedule.timingStatus === "due" || schedule.timingStatus === "overdue";
      }

      if (status === "upcoming") {
        return schedule.timingStatus === "upcoming";
      }

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

  await validateScheduleReferences(
    parsed.trackerId,
    parsed.direction,
    parsed.categoryId,
    parsed.payeeId
  );

  const firstDueDate = addInterval(
    parsed.nextDueDate,
    parsed.frequency,
    parsed.intervalValue
  );

  const [created] = await db
    .insert(schedules)
    .values({
      trackerId: parsed.trackerId,
      name: parsed.name,
      amountCents,
      direction: parsed.direction,
      categoryId: parsed.categoryId,
      payeeId: parsed.payeeId,
      notesTemplate: parsed.notesTemplate ?? null,
      frequency: parsed.frequency,
      intervalValue: parsed.intervalValue,
      nextDueDate: firstDueDate,
      isActive: parsed.isActive ?? true,
      autoCreateDisabled: true,
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

export async function updateSchedule(scheduleId: string, input: unknown) {
  const parsed = scheduleUpdateSchema.parse(input);
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId))
    .limit(1);
  const schedule = rows[0];

  if (!schedule) {
    throw new Error("Schedule not found");
  }

  if (!schedule.isActive && parsed.isActive === true && parsed.nextDueDate === undefined) {
    throw new Error("Reactivating a schedule requires a new next due date");
  }

  const nextDirection = parsed.direction ?? schedule.direction;
  const nextCategoryId = parsed.categoryId ?? schedule.categoryId;
  const nextPayeeId = parsed.payeeId ?? schedule.payeeId;

  await validateScheduleReferences(
    schedule.trackerId,
    nextDirection,
    nextCategoryId,
    nextPayeeId
  );

  const amountCents =
    parsed.amount !== undefined
      ? parseAmountToCents(parsed.amount)
      : schedule.amountCents;

  if (amountCents === null || amountCents <= 0) {
    throw new Error("Invalid schedule amount");
  }

  const [updated] = await db
    .update(schedules)
    .set({
      name: parsed.name ?? schedule.name,
      amountCents,
      direction: nextDirection,
      categoryId: nextCategoryId,
      payeeId: nextPayeeId,
      notesTemplate:
        parsed.notesTemplate === undefined
          ? schedule.notesTemplate
          : parsed.notesTemplate,
      frequency: parsed.frequency ?? schedule.frequency,
      intervalValue: parsed.intervalValue ?? schedule.intervalValue,
      nextDueDate: parsed.nextDueDate ?? schedule.nextDueDate,
      isActive: parsed.isActive ?? schedule.isActive,
      autoCreateDisabled: true,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId))
    .returning();

  return updated;
}

export async function createTransactionFromSchedule(
  scheduleId: string,
  actorUserId: string
) {
  const schedule = await getScheduleRowById(scheduleId);

  if (!schedule) {
    throw new Error("Schedule not found");
  }

  if (!schedule.isActive) {
    throw new Error("Completed schedules cannot create transactions");
  }

  if (!schedule.categoryId || !schedule.payeeId || !schedule.categoryName || !schedule.payeeName) {
    throw new Error("Schedule is incomplete and cannot create a transaction");
  }

  const bookingDate = toDateInputValue(new Date());

  const transaction = await createTransaction(
    {
      trackerId: schedule.trackerId,
      date: bookingDate,
      amount: schedule.amountCents / 100,
      direction: schedule.direction,
      categoryId: schedule.categoryId,
      payeeId: schedule.payeeId,
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
      lastCompletedDate: bookingDate,
      nextDueDate,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, schedule.id));

  await logAuditEvent({
    actorUserId,
    action: "schedule_transaction_created",
    resourceType: "schedule",
    resourceId: schedule.id,
    metadata: {
      transactionId: transaction.id,
      bookingDate,
      scheduledDate: schedule.nextDueDate,
      nextDueDate,
    },
    ...(await getRequestAuditContext()),
  });

  return transaction;
}

async function getScheduleRowById(scheduleId: string) {
  const rows = await db
    .select({
      id: schedules.id,
      trackerId: schedules.trackerId,
      name: schedules.name,
      amountCents: schedules.amountCents,
      direction: schedules.direction,
      categoryId: schedules.categoryId,
      payeeId: schedules.payeeId,
      notesTemplate: schedules.notesTemplate,
      frequency: schedules.frequency,
      intervalValue: schedules.intervalValue,
      nextDueDate: schedules.nextDueDate,
      lastCompletedDate: schedules.lastCompletedDate,
      isActive: schedules.isActive,
      createdByUserId: schedules.createdByUserId,
      categoryName: categories.name,
      payeeName: payees.name,
    })
    .from(schedules)
    .leftJoin(categories, eq(categories.id, schedules.categoryId))
    .leftJoin(payees, eq(payees.id, schedules.payeeId))
    .where(eq(schedules.id, scheduleId))
    .limit(1);

  return rows[0] ?? null;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function expandScheduleOccurrences(
  schedule: ScheduleRow,
  endDate: string
) {
  const items: ScheduleForecastItem[] = [];
  let cursor = schedule.nextDueDate;
  let occurrenceIndex = 0;

  while (cursor <= endDate && occurrenceIndex < 512) {
    items.push({
      scheduleId: schedule.id,
      occurrenceKey: `${schedule.id}-${cursor}-${occurrenceIndex}`,
      name: schedule.name,
      payeeName: schedule.payeeName!,
      categoryName: schedule.categoryName!,
      date: cursor,
      amountCents: schedule.amountCents,
      direction: schedule.direction,
      status: classifyScheduleStatus(cursor),
    });

    const nextCursor = addInterval(cursor, schedule.frequency, schedule.intervalValue);
    if (nextCursor <= cursor) {
      break;
    }

    cursor = nextCursor;
    occurrenceIndex += 1;
  }

  return items;
}

export async function getScheduleForecast(trackerId: string, requestedDays = 14) {
  const days = clampForecastDays(requestedDays);
  const today = toDateInputValue(new Date());
  const endDate = addDays(today, days);

  const rows = await getScheduleRows(trackerId);
  const activeSchedules = rows.filter(
    (schedule) =>
      schedule.isActive &&
      schedule.categoryId &&
      schedule.payeeId &&
      schedule.categoryName &&
      schedule.payeeName
  );

  const items = activeSchedules
    .flatMap((schedule) => expandScheduleOccurrences(schedule, endDate))
    .sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));

  const [totals] = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.trackerId, trackerId));

  const baseBalanceCents = (totals?.incomeCents ?? 0) - (totals?.expenseCents ?? 0);
  const scheduledIncomeCents = items
    .filter((item) => item.direction === "income")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const scheduledExpenseCents = items
    .filter((item) => item.direction === "expense")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const projectedDeltaCents = scheduledIncomeCents - scheduledExpenseCents;

  return {
    days,
    baseBalanceCents,
    projectedDeltaCents,
    projectedBalanceCents: baseBalanceCents + projectedDeltaCents,
    scheduledIncomeCents,
    scheduledExpenseCents,
    items,
  };
}
