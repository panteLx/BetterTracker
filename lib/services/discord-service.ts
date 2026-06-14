import { db } from "@/lib/db";
import { notificationEvents, trackers } from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { eq } from "drizzle-orm";

type NotifyInput = {
  type: "transaction_created" | "schedule_attention" | "admin_test";
  trackerId: string;
  title: string;
  description: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  createdByUserId?: string | null;
  includeDebug?: boolean;
  debugPayload?: unknown;
};

type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

function toDebugString(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function clampFieldValue(value: string, maxLength = 1024) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function buildDebugFields(input: NotifyInput, notificationEventId: string): DiscordField[] {
  const baseFields: DiscordField[] = [
    { name: "Notification Event ID", value: notificationEventId, inline: false },
    { name: "Tracker ID", value: input.trackerId, inline: false },
    { name: "Type", value: input.type, inline: true },
    { name: "Actor User ID", value: input.createdByUserId ?? "-", inline: false },
  ];

  if (!input.debugPayload || typeof input.debugPayload !== "object") {
    return baseFields;
  }

  const payload = input.debugPayload as Record<string, unknown>;
  const extraFields: DiscordField[] = [
    { name: "Transaction ID", value: toDebugString(payload.id), inline: false },
    { name: "Source", value: toDebugString(payload.source), inline: true },
    { name: "Direction", value: toDebugString(payload.direction), inline: true },
    { name: "Amount (cents)", value: toDebugString(payload.amountCents), inline: true },
    { name: "Date", value: toDebugString(payload.date), inline: true },
    { name: "Account", value: toDebugString(payload.accountName), inline: true },
    { name: "Category ID", value: toDebugString(payload.categoryId), inline: false },
    { name: "Payee ID", value: toDebugString(payload.payeeId), inline: false },
    { name: "Schedule ID", value: toDebugString(payload.scheduleId), inline: false },
    { name: "Created By", value: toDebugString(payload.createdByUserId), inline: false },
    { name: "Created At", value: toDebugString(payload.createdAt), inline: false },
    { name: "Notes", value: toDebugString(payload.notes), inline: false },
  ];

  return [...baseFields, ...extraFields]
    .filter((field) => field.value !== "-")
    .slice(0, 25)
    .map((field) => ({
      ...field,
      value: clampFieldValue(field.value),
    }));
}

export async function sendDiscordNotification(input: NotifyInput) {
  const [tracker] = await db
    .select({
      webhookUrl: trackers.discordWebhookUrl,
      debugEnabled: trackers.discordDebugEnabled,
      pingRoleId: trackers.discordPingRoleId,
    })
    .from(trackers)
    .where(eq(trackers.id, input.trackerId))
    .limit(1);

  const webhookUrl = tracker?.webhookUrl || "";
  const debugEnabled = tracker?.debugEnabled ?? false;
  const pingRoleId = tracker?.pingRoleId || "";
  const shouldIncludeDebug = input.includeDebug && debugEnabled;

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

  const [event] = await db
    .insert(notificationEvents)
    .values({
      type: input.type,
      status: "pending",
      payloadJson: JSON.stringify(basePayload),
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();

  const storedPayload = {
    ...basePayload,
    embeds: shouldIncludeDebug
      ? [
          ...basePayload.embeds,
          {
            title: "Debug Details",
            description: "Zusatzinformationen fuer Diagnose und Nachvollziehbarkeit.",
            fields: buildDebugFields(input, event.id),
            color: 0xf59e0b,
            timestamp: new Date().toISOString(),
          },
        ]
      : basePayload.embeds,
    debug: shouldIncludeDebug ? input.debugPayload ?? null : undefined,
  };

  await db
    .update(notificationEvents)
    .set({
      payloadJson: JSON.stringify(storedPayload),
    })
    .where(eq(notificationEvents.id, event.id));

  if (!webhookUrl) {
    await db
      .update(notificationEvents)
      .set({
        status: "failed",
        errorMessage: "Discord webhook URL is not configured",
      })
      .where(eq(notificationEvents.id, event.id));

    await logAuditEvent({
      actorUserId: input.createdByUserId ?? null,
      action: "discord_notification_failed",
      resourceType: "notification_event",
      resourceId: event.id,
      severity: "warning",
      metadata: { reason: "missing_webhook", trackerId: input.trackerId },
    });

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
        metadata: { status: response.status, trackerId: input.trackerId },
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
      metadata: { message, trackerId: input.trackerId },
    });
    return { ok: false };
  }
}
