import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";

export async function getTrackerById(trackerId: string) {
  const rows = await db.select().from(trackers).where(eq(trackers.id, trackerId)).limit(1);
  return rows[0] ?? null;
}

export async function isTrackerActive(trackerId: string) {
  const tracker = await getTrackerById(trackerId);
  return tracker?.isActive ?? false;
}

export type TrackerUpdateInput = {
  name?: string;
  description?: string | null;
  color?: string;
  currency?: string;
  discordWebhookUrl?: string;
  discordDebugEnabled?: boolean;
  discordPingRoleId?: string;
  weightTrackingEnabled?: boolean;
  isActive?: boolean;
  isHidden?: boolean;
  isPublic?: boolean;
};

export function buildTrackerUpdateValues(body: TrackerUpdateInput) {
  return {
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
    weightTrackingEnabled: body.weightTrackingEnabled,
    isActive: body.isActive,
    isHidden: body.isHidden,
    isPublic: body.isPublic,
    updatedAt: new Date(),
  };
}
