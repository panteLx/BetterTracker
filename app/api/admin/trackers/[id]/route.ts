import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { notFound, ok, mapServiceError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { buildTrackerUpdateValues, type TrackerUpdateInput } from "@/lib/trackers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<TrackerUpdateInput>(request);

    const [updated] = await db
      .update(trackers)
      .set(buildTrackerUpdateValues(body))
      .where(eq(trackers.id, id))
      .returning();

    if (!updated) {
      return notFound("Tracker not found");
    }

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "admin_tracker_updated",
      resourceType: "tracker",
      resourceId: id,
      metadata: body,
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return mapServiceError(error);
  }
}
