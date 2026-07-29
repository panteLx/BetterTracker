import { canWriteTracker } from "@/lib/auth/permissions";
import { requireTrackerReadAccess } from "@/lib/auth/guards";
import { conflict, forbidden, mapServiceError, notFound, ok } from "@/lib/http";
import { skipSchedule } from "@/lib/services/schedule-service";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getSchedule(id: string) {
  const rows = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const schedule = await getSchedule(id);
  if (!schedule) return notFound("Schedule not found");

  const access = await requireTrackerReadAccess(request.headers, schedule.trackerId);
  if (access.response) return access.response;
  if (!canWriteTracker(access.trackerAccess!.permission)) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }

  try {
    const item = await skipSchedule(id, access.user!.id);
    return ok({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
