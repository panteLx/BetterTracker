import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { requireTrackerWriteAccess } from "@/lib/auth/guards";
import { conflict, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { slugify } from "@/lib/utils";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { getTrackerById } from "@/lib/trackers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireTrackerWriteAccess(request.headers, id, {
    allowArchived: true,
  });
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      name?: string;
      description?: string | null;
      color?: string;
      currency?: string;
      discordWebhookUrl?: string;
      discordDebugEnabled?: boolean;
      discordPingRoleId?: string;
      isActive?: boolean;
      isHidden?: boolean;
    }>(request);

    const currentTracker = await getTrackerById(id);
    if (!currentTracker) return notFound("Tracker not found");

    const wantsOnlyReactivation =
      currentTracker.isActive === false &&
      body.isActive === true &&
      (body.name === undefined || body.name.trim() === currentTracker.name) &&
      (body.description === undefined ||
        (body.description?.trim() || null) === currentTracker.description) &&
      (body.color === undefined || body.color === currentTracker.color) &&
      (body.currency === undefined ||
        body.currency.trim().toUpperCase() === currentTracker.currency) &&
      (body.discordWebhookUrl === undefined ||
        body.discordWebhookUrl.trim() === currentTracker.discordWebhookUrl) &&
      (body.discordDebugEnabled === undefined ||
        body.discordDebugEnabled === currentTracker.discordDebugEnabled) &&
      (body.discordPingRoleId === undefined ||
        body.discordPingRoleId.trim() === currentTracker.discordPingRoleId) &&
      (body.isHidden === undefined || body.isHidden === currentTracker.isHidden);

    const wantsOnlyVisibilityChange =
      currentTracker.isActive === false &&
      body.isHidden !== undefined &&
      (body.isActive === undefined || body.isActive === currentTracker.isActive) &&
      (body.name === undefined || body.name.trim() === currentTracker.name) &&
      (body.description === undefined ||
        (body.description?.trim() || null) === currentTracker.description) &&
      (body.color === undefined || body.color === currentTracker.color) &&
      (body.currency === undefined ||
        body.currency.trim().toUpperCase() === currentTracker.currency) &&
      (body.discordWebhookUrl === undefined ||
        body.discordWebhookUrl.trim() === currentTracker.discordWebhookUrl) &&
      (body.discordDebugEnabled === undefined ||
        body.discordDebugEnabled === currentTracker.discordDebugEnabled) &&
      (body.discordPingRoleId === undefined ||
        body.discordPingRoleId.trim() === currentTracker.discordPingRoleId);

    if (!currentTracker.isActive && !wantsOnlyReactivation && !wantsOnlyVisibilityChange) {
      return conflict("Tracker is archived and cannot be modified");
    }

    const updateValues = {
      name: body.name?.trim(),
      slug: body.name ? slugify(body.name) : undefined,
      description:
        body.description === undefined ? undefined : body.description?.trim() || null,
      color: body.color,
      currency: body.currency?.trim().toUpperCase(),
      discordWebhookUrl:
        body.discordWebhookUrl === undefined ? undefined : body.discordWebhookUrl.trim(),
      discordDebugEnabled: body.discordDebugEnabled,
      discordPingRoleId:
        body.discordPingRoleId === undefined ? undefined : body.discordPingRoleId.trim(),
      isActive: body.isActive,
      isHidden: body.isHidden,
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
