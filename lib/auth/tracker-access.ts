import { and, asc, eq, like, notInArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackerMembers, trackers, user } from "@/lib/db/schema";
import {
  canCreateTrackerContent,
  canEditOwnTrackerContent,
  canManageTracker,
  canManageTrackerMembers,
  canManageTrackerReferenceData,
  canReadTracker,
  type TrackerPermission,
} from "@/lib/auth/permissions";

const trackerSelect = {
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
  isPublic: trackers.isPublic,
  sortOrder: trackers.sortOrder,
  createdAt: trackers.createdAt,
  updatedAt: trackers.updatedAt,
};

export type TrackerListItem = typeof trackers.$inferSelect & {
  permission: TrackerPermission;
};

export type TrackerAccess = {
  tracker: typeof trackers.$inferSelect;
  permission: TrackerPermission;
  canRead: boolean;
  canCreateContent: boolean;
  canManageTracker: boolean;
  canManageMembers: boolean;
  canManageReferenceData: boolean;
  canEditOwnContent: boolean;
};

function toTrackerAccess(
  tracker: typeof trackers.$inferSelect,
  permission: TrackerPermission
): TrackerAccess {
  return {
    tracker,
    permission,
    canRead: canReadTracker(permission),
    canCreateContent: canCreateTrackerContent(permission),
    canManageTracker: canManageTracker(permission),
    canManageMembers: canManageTrackerMembers(permission),
    canManageReferenceData: canManageTrackerReferenceData(permission),
    canEditOwnContent: canEditOwnTrackerContent(permission),
  };
}

export async function listTrackersForUser(userId: string) {
  const rows = await db
    .select({
      ...trackerSelect,
      permission: trackerMembers.permission,
    })
    .from(trackers)
    .innerJoin(
      trackerMembers,
      and(eq(trackerMembers.trackerId, trackers.id), eq(trackerMembers.userId, userId))
    )
    .where(eq(trackers.isHidden, false))
    .orderBy(asc(trackers.sortOrder), asc(trackers.name));

  return rows as TrackerListItem[];
}

export async function getTrackerAccessForUser(
  trackerId: string,
  userId: string,
  options?: { includeHidden?: boolean }
) {
  const rows = await db
    .select({
      ...trackerSelect,
      permission: trackerMembers.permission,
    })
    .from(trackers)
    .innerJoin(
      trackerMembers,
      and(eq(trackers.id, trackerMembers.trackerId), eq(trackerMembers.userId, userId))
    )
    .where(eq(trackers.id, trackerId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  if (row.isHidden && !options?.includeHidden) {
    return null;
  }

  return toTrackerAccess(row, row.permission as TrackerPermission);
}

export async function listTrackerMembers(trackerId: string) {
  return db
    .select({
      id: trackerMembers.id,
      trackerId: trackerMembers.trackerId,
      userId: trackerMembers.userId,
      permission: trackerMembers.permission,
      createdAt: trackerMembers.createdAt,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    })
    .from(trackerMembers)
    .innerJoin(user, eq(user.id, trackerMembers.userId))
    .where(eq(trackerMembers.trackerId, trackerId))
    .orderBy(asc(user.name), asc(user.email));
}

export async function getTrackerMember(memberId: string) {
  const rows = await db
    .select()
    .from(trackerMembers)
    .where(eq(trackerMembers.id, memberId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getTrackerMemberByUser(trackerId: string, userId: string) {
  const rows = await db
    .select()
    .from(trackerMembers)
    .where(and(eq(trackerMembers.trackerId, trackerId), eq(trackerMembers.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function listTrackerMemberCandidates(trackerId: string, query: string) {
  const term = query.trim();
  if (!term) {
    return [];
  }

  const existingMembers = await db
    .select({ userId: trackerMembers.userId })
    .from(trackerMembers)
    .where(eq(trackerMembers.trackerId, trackerId));

  const excludedUserIds = existingMembers.map((item) => item.userId);
  const matcher = `%${term}%`;

  const conditions = [
    or(like(user.name, matcher), like(user.email, matcher))!,
  ];

  if (excludedUserIds.length > 0) {
    conditions.push(notInArray(user.id, excludedUserIds));
  }

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(and(...conditions))
    .orderBy(asc(user.name), asc(user.email))
    .limit(20);
}
