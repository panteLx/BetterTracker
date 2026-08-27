import { db } from "@/lib/db";
import { notificationEvents, trackers } from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { eq } from "drizzle-orm";
import { isDiscordWebhookUrl } from "@/lib/validators/discord-webhook";

const DISCORD_REQUEST_TIMEOUT_MS = 5000;

type NotifyInput = {
  type: "transaction_created" | "schedule_attention" | "admin_test";
  trackerId: string;
  title: string;
  description: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  createdByUserId?: string | null;
  includeDebug?: boolean;
  debugPayload?: unknown;
  debugFields?: Array<{ name: string; value: string; inline?: boolean }>;
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

function formatDebugFieldName(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildObjectDebugFields(value: unknown): DiscordField[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).map(([key, fieldValue]) => ({
    name: formatDebugFieldName(key),
    value: toDebugString(fieldValue),
    inline: false,
  }));
}

function buildDebugFields(input: NotifyInput, notificationEventId: string): DiscordField[] {
  const baseFields: DiscordField[] = [
    { name: "Notification Event ID", value: notificationEventId, inline: false },
    { name: "Tracker ID", value: input.trackerId, inline: false },
    { name: "Type", value: input.type, inline: true },
    { name: "Actor User ID", value: input.createdByUserId ?? "-", inline: false },
  ];

  const extraFields = input.debugFields?.length
    ? input.debugFields
    : buildObjectDebugFields(input.debugPayload);

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

  // Re-checked here as well as on every write path, so a row stored by older
  // code cannot be used to make the server dial an arbitrary internal host.
  if (!isDiscordWebhookUrl(webhookUrl)) {
    await db
      .update(notificationEvents)
      .set({
        status: "failed",
        errorMessage: "Discord webhook URL is not a valid Discord endpoint",
      })
      .where(eq(notificationEvents.id, event.id));

    await logAuditEvent({
      actorUserId: input.createdByUserId ?? null,
      action: "discord_notification_failed",
      resourceType: "notification_event",
      resourceId: event.id,
      severity: "warning",
      metadata: { reason: "invalid_webhook", trackerId: input.trackerId },
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
      // A redirect could otherwise walk the request back to an internal host,
      // and a hung endpoint must not hold the request open indefinitely.
      redirect: "error",
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
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
