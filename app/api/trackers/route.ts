import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackerMembers, trackers } from "@/lib/db/schema";
import { requireAuthenticatedApi } from "@/lib/auth/guards";
import { logAuditEvent, getRequestAuditContext } from "@/lib/audit-log";
import { badRequest, created, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { getSettings } from "@/lib/services/admin-settings-service";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";
import { slugify } from "@/lib/utils";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedApi(request.headers);
  if (authResult.response) return authResult.response;
  const { searchParams } = new URL(request.url);
  const includeHidden =
    searchParams.get("includeHidden") === "1" &&
    authResult.user!.role !== "user";

  try {
    const baseItems = includeHidden
      ? await db
          .select({
            id: trackers.id,
            name: trackers.name,
            slug: trackers.slug,
            description: trackers.description,
            color: trackers.color,
            currency: trackers.currency,
            discordWebhookUrl: trackers.discordWebhookUrl,
            discordDebugEnabled: trackers.discordDebugEnabled,
            discordPingRoleId: trackers.discordPingRoleId,
            isActive: trackers.isActive,
            isHidden: trackers.isHidden,
            sortOrder: trackers.sortOrder,
          })
          .from(trackers)
          .orderBy(asc(trackers.sortOrder), asc(trackers.name))
      : await db
          .select({
            id: trackers.id,
            name: trackers.name,
            slug: trackers.slug,
            description: trackers.description,
            color: trackers.color,
            currency: trackers.currency,
            discordWebhookUrl: trackers.discordWebhookUrl,
            discordDebugEnabled: trackers.discordDebugEnabled,
            discordPingRoleId: trackers.discordPingRoleId,
            isActive: trackers.isActive,
            isHidden: trackers.isHidden,
            sortOrder: trackers.sortOrder,
          })
          .from(trackers)
          .where(eq(trackers.isHidden, false))
          .orderBy(asc(trackers.sortOrder), asc(trackers.name));

    const items =
      authResult.user!.role === "user"
        ? baseItems.map((item) => ({ ...item, permission: "write" as const }))
        : baseItems;

    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedApi(request.headers);
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
    const [tracker] = await db
      .insert(trackers)
      .values({
        name: body.name.trim(),
        slug,
        description: body.description?.trim() || null,
        color: body.color || DEFAULT_TRACKER_COLOR,
        currency: body.currency?.trim().toUpperCase() || "EUR",
        discordWebhookUrl: body.discordWebhookUrl?.trim() || settings.discordWebhookUrl,
        discordDebugEnabled: body.discordDebugEnabled ?? settings.discordDebugEnabled,
        discordPingRoleId: body.discordPingRoleId?.trim() || settings.discordPingRoleId,
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

    return created({ item: tracker });
  } catch (error) {
    return serverError(error);
  }
}
