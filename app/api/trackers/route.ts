import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackerMembers, trackers } from "@/lib/db/schema";
import { listTrackersForUser } from "@/lib/auth/tracker-access";
import { requireTrackerModuleApi, requireTrackerReadAccess } from "@/lib/auth/guards";
import { canManageTracker } from "@/lib/auth/permissions";
import { parseDiscordWebhookUrl } from "@/lib/validators/discord-webhook";
import { logAuditEvent, getRequestAuditContext } from "@/lib/audit-log";
import { badRequest, conflict, created, forbidden, mapServiceError, ok } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { getSettings } from "@/lib/services/admin-settings-service";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";
import { slugify } from "@/lib/utils";

export async function GET(request: Request) {
  const authResult = await requireTrackerModuleApi(request.headers);
  if (authResult.response) return authResult.response;

  try {
    const items = await listTrackersForUser(authResult.user!.id);
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: Request) {
  const authResult = await requireTrackerModuleApi(request.headers);
  if (authResult.response) return authResult.response;

  try {
    const body = await parseRequestJson<{
      name?: string;
      description?: string | null;
      color?: string;
      currency?: string;
      discordWebhookUrl?: string;
      discordDebugEnabled?: boolean;
      discordPingRoleId?: string;
    }>(request);

    if (!body.name?.trim()) {
      return badRequest("Tracker name is required");
    }

    const settings = await getSettings();
    const slug = slugify(body.name);

    const [existingSlug] = await db
      .select({ id: trackers.id })
      .from(trackers)
      .where(eq(trackers.slug, slug))
      .limit(1);

    if (existingSlug) {
      return conflict("A tracker with this name already exists");
    }

    const webhookUrl =
      body.discordWebhookUrl === undefined
        ? settings.discordWebhookUrl
        : parseDiscordWebhookUrl(body.discordWebhookUrl) || settings.discordWebhookUrl;

    const [sortOrderRow] = await db
      .select({
        value: sql<number>`coalesce(max(${trackers.sortOrder}), -1) + 1`,
      })
      .from(trackers);
    const [tracker] = await db
      .insert(trackers)
      .values({
        name: body.name.trim(),
        slug,
        description: body.description?.trim() || null,
        color: body.color || DEFAULT_TRACKER_COLOR,
        currency: body.currency?.trim().toUpperCase() || "EUR",
        discordWebhookUrl: webhookUrl,
        discordDebugEnabled: body.discordDebugEnabled ?? settings.discordDebugEnabled,
        discordPingRoleId: body.discordPingRoleId?.trim() || settings.discordPingRoleId,
        sortOrder: sortOrderRow?.value ?? 0,
      })
      .returning();

    await db.insert(trackerMembers).values({
      trackerId: tracker.id,
      userId: authResult.user!.id,
      permission: "owner",
    });

    await logAuditEvent({
      actorUserId: authResult.user!.id,
      action: "tracker_created",
      resourceType: "tracker",
      resourceId: tracker.id,
      metadata: tracker,
      ...(await getRequestAuditContext()),
    });

    return created({ item: { ...tracker, permission: "owner" as const } });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireTrackerModuleApi(request.headers);
  if (authResult.response) return authResult.response;

  try {
    const body = await parseRequestJson<{ trackerIds?: string[] }>(request);
    const trackerIds = body.trackerIds?.filter(Boolean) ?? [];

    if (trackerIds.length === 0) {
      return badRequest("trackerIds is required");
    }

    if (new Set(trackerIds).size !== trackerIds.length) {
      return badRequest("trackerIds must be unique");
    }

    for (const trackerId of trackerIds) {
      const access = await requireTrackerReadAccess(request.headers, trackerId);
      if (access.response) {
        return access.response;
      }

      // sortOrder is a single column shared by every user of the instance, so
      // reordering is a management action, not a personal preference.
      if (!canManageTracker(access.trackerAccess!.permission)) {
        return forbidden();
      }
    }

    const existingTrackers = await db
      .select({ id: trackers.id })
      .from(trackers)
      .where(inArray(trackers.id, trackerIds));

    if (existingTrackers.length !== trackerIds.length) {
      return badRequest("One or more trackers were not found");
    }

    for (const [index, trackerId] of trackerIds.entries()) {
      await db
        .update(trackers)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(and(eq(trackers.id, trackerId), inArray(trackers.id, trackerIds)));
    }

    await logAuditEvent({
      actorUserId: authResult.user!.id,
      action: "tracker_reordered",
      resourceType: "tracker",
      resourceId: trackerIds[0],
      metadata: { trackerIds },
      ...(await getRequestAuditContext()),
    });

    const items = await listTrackersForUser(authResult.user!.id);
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}
