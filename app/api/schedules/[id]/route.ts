import { eq } from "drizzle-orm";
import { canMutateTrackerResource } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { updateSchedule } from "@/lib/services/schedule-service";
import { requireTrackerReadAccess } from "@/lib/auth/guards";
import { badRequest, conflict, forbidden, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";

function mapScheduleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  const isZodError =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ZodError";

  if (isZodError) {
    return badRequest(message);
  }

  if (message.includes("requires a new next due date")) {
    return conflict(message);
  }

  if (
    message.includes("Invalid schedule amount") ||
    message.includes("not found in tracker") ||
    message.includes("does not match the selected direction") ||
    message.includes("Unrecognized key")
  ) {
    return badRequest(message);
  }

  return serverError(error);
}

async function getSchedule(id: string) {
  const rows = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const schedule = await getSchedule(id);
  if (!schedule) return notFound("Schedule not found");
  const access = await requireTrackerReadAccess(request.headers, schedule.trackerId);
  if (access.response) return access.response;
  if (
    !canMutateTrackerResource(
      access.trackerAccess!.permission,
      access.user!.id,
      schedule.createdByUserId
    )
  ) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }

  try {
    const body = await parseRequestJson<Record<string, unknown>>(request);
    const updated = await updateSchedule(id, body);

    return ok({ item: updated });
  } catch (error) {
    return mapScheduleError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const schedule = await getSchedule(id);
  if (!schedule) return notFound("Schedule not found");
  const access = await requireTrackerReadAccess(request.headers, schedule.trackerId);
  if (access.response) return access.response;
  if (
    !canMutateTrackerResource(
      access.trackerAccess!.permission,
      access.user!.id,
      schedule.createdByUserId
    )
  ) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }

  try {
    await db.delete(schedules).where(eq(schedules.id, id));
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
