import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { requireTrackerWriteAccess } from "@/lib/auth/guards";
import { notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { slugify } from "@/lib/utils";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireTrackerWriteAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      name?: string;
      description?: string | null;
      color?: string;
      currency?: string;
      isActive?: boolean;
    }>(request);

    const updateValues = {
      name: body.name?.trim(),
      slug: body.name ? slugify(body.name) : undefined,
      description: body.description?.trim() || null,
      color: body.color,
      currency: body.currency,
      isActive: body.isActive,
      updatedAt: new Date(),
    };

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
  const access = await requireTrackerWriteAccess(request.headers, id);
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
