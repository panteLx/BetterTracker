import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { slugify } from "@/lib/utils";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
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

    const [updated] = await db
      .update(trackers)
      .set({
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
      })
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
    return serverError(error);
  }
}
