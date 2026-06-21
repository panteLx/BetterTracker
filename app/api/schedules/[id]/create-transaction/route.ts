import { createTransactionFromSchedule } from "@/lib/services/schedule-service";
import { canWriteTracker } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireTrackerReadAccess } from "@/lib/auth/guards";
import { conflict, forbidden, notFound, ok, serverError } from "@/lib/http";

function mapScheduleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";

  if (message.includes("cannot create")) {
    return conflict(message);
  }

  return serverError(error);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const rows = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
  const schedule = rows[0];
  if (!schedule) return notFound("Schedule not found");
  const access = await requireTrackerReadAccess(request.headers, schedule.trackerId);
  if (access.response) return access.response;
  if (!canWriteTracker(access.trackerAccess!.permission)) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }
  if (!schedule.isActive) {
    return conflict("Completed schedules cannot create transactions");
  }
  if (!schedule.categoryId || !schedule.payeeId) {
    return conflict("Schedule is incomplete and cannot create a transaction");
  }

  try {
    const item = await createTransactionFromSchedule(id, access.user!.id);
    return ok({ item });
  } catch (error) {
    return mapScheduleError(error);
  }
}
