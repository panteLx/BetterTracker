import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { requireTrackerManageAccess } from "@/lib/auth/guards";
import { notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { buildTrackerUpdateValues, getTrackerById, type TrackerUpdateInput } from "@/lib/trackers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireTrackerManageAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<TrackerUpdateInput>(request);

    const currentTracker = await getTrackerById(id);
    if (!currentTracker) return notFound("Tracker not found");

    const updateValues = buildTrackerUpdateValues(body);

    const [updated] = await db
      .update(trackers)
      .set(updateValues)
      .where(eq(trackers.id, id))
      .returning();

    if (!updated) return notFound("Tracker not found");

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "tracker_updated",
      resourceType: "tracker",
      resourceId: id,
      metadata: updateValues,
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireTrackerManageAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const [deleted] = await db.delete(trackers).where(eq(trackers.id, id)).returning();
    if (!deleted) return notFound("Tracker not found");

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "tracker_deleted",
      resourceType: "tracker",
      resourceId: id,
      metadata: { name: deleted.name },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
