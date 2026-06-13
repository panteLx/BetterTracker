import { count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { ok, parseRequestJson, serverError } from "@/lib/http";
import { getSettings, setSetting } from "@/lib/services/admin-settings-service";

export async function POST(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      discordWebhookUrl?: string;
      discordDebugEnabled?: boolean;
      discordPingRoleId?: string;
    }>(request);

    if (body.discordWebhookUrl !== undefined) {
      await setSetting("discordWebhookUrl", body.discordWebhookUrl.trim(), access.user!.id);
    }

    if (body.discordDebugEnabled !== undefined) {
      await setSetting("discordDebugEnabled", body.discordDebugEnabled, access.user!.id);
    }

    if (body.discordPingRoleId !== undefined) {
      await setSetting("discordPingRoleId", body.discordPingRoleId.trim(), access.user!.id);
    }

    const settings = await getSettings();
    const [trackerCount] = await db.select({ value: count() }).from(trackers);

    await db.update(trackers).set({
      discordWebhookUrl: settings.discordWebhookUrl,
      discordDebugEnabled: settings.discordDebugEnabled,
      discordPingRoleId: settings.discordPingRoleId,
      updatedAt: new Date(),
    });

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "tracker_discord_defaults_applied",
      resourceType: "tracker",
      severity: "info",
      metadata: {
        updatedCount: trackerCount.value,
      },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true, updatedCount: trackerCount.value });
  } catch (error) {
    return serverError(error);
  }
}
