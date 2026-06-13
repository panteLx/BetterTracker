import { db } from "@/lib/db";
import { notificationEvents } from "@/lib/db/schema";
import { getSetting } from "@/lib/services/admin-settings-service";
import { logAuditEvent } from "@/lib/audit-log";
import { eq } from "drizzle-orm";

type NotifyInput = {
  type: "transaction_created" | "schedule_attention" | "admin_test";
  title: string;
  description: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  createdByUserId?: string | null;
  includeDebug?: boolean;
  debugPayload?: unknown;
};

export async function sendDiscordNotification(input: NotifyInput) {
  const webhookUrl = await getSetting<string>("discordWebhookUrl");
  const debugEnabled = await getSetting<boolean>("discordDebugEnabled");
  const pingRoleId = await getSetting<string>("discordPingRoleId");

  const basePayload = {
    embeds: [
      {
        title: input.title,
        description: input.description,
        fields: input.fields,
        timestamp: new Date().toISOString(),
      },
    ],
    content: pingRoleId ? `<@&${pingRoleId}>` : undefined,
  };

  const storedPayload = {
    ...basePayload,
    debug:
      input.includeDebug && debugEnabled ? input.debugPayload ?? null : undefined,
  };

  const [event] = await db
    .insert(notificationEvents)
    .values({
      type: input.type,
      status: "pending",
      payloadJson: JSON.stringify(storedPayload),
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();

  if (!webhookUrl) {
    await db
      .update(notificationEvents)
      .set({
        status: "failed",
        errorMessage: "Discord webhook URL is not configured",
      })
      .where(eq(notificationEvents.id, event.id));
    return { ok: false };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(storedPayload),
    });

    await db
      .update(notificationEvents)
      .set({
        status: response.ok ? "sent" : "failed",
        responseCode: response.status,
        errorMessage: response.ok ? null : await response.text(),
      })
      .where(eq(notificationEvents.id, event.id));

    if (!response.ok) {
      await logAuditEvent({
        actorUserId: input.createdByUserId ?? null,
        action: "discord_notification_failed",
        resourceType: "notification_event",
        resourceId: event.id,
        severity: "warning",
        metadata: { status: response.status },
      });
    }

    return { ok: response.ok };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(notificationEvents)
      .set({
        status: "failed",
        errorMessage: message,
      })
      .where(eq(notificationEvents.id, event.id));

    await logAuditEvent({
      actorUserId: input.createdByUserId ?? null,
      action: "discord_notification_failed",
      resourceType: "notification_event",
      resourceId: event.id,
      severity: "error",
      metadata: { message },
    });
    return { ok: false };
  }
}
