import { db } from "@/lib/db";
import { trackerMembers, user } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type Role = "user" | "admin" | "superadmin";
export type TrackerPermission = "owner" | "admin" | "write" | "read";

export function isAdminRole(role?: string | null): role is "admin" | "superadmin" {
  return role === "admin" || role === "superadmin";
}

export function isSuperAdminRole(role?: string | null): role is "superadmin" {
  return role === "superadmin";
}

export async function getTrackerPermission(
  trackerId: string,
  userId: string
): Promise<TrackerPermission | null> {
  const rows = await db
    .select({ permission: trackerMembers.permission })
    .from(trackerMembers)
    .where(and(eq(trackerMembers.trackerId, trackerId), eq(trackerMembers.userId, userId)))
    .limit(1);

  return rows[0]?.permission ?? null;
}

export function canManageTracker(permission: TrackerPermission | null) {
  return permission === "owner" || permission === "admin";
}

export function canManageTrackerMembers(permission: TrackerPermission | null) {
  return canManageTracker(permission);
}

export function canManageTrackerReferenceData(permission: TrackerPermission | null) {
  return canManageTracker(permission);
}

export function canWriteTracker(permission: TrackerPermission | null) {
  return permission === "owner" || permission === "admin" || permission === "write";
}

export function canReadTracker(permission: TrackerPermission | null) {
  return canWriteTracker(permission) || permission === "read";
}

export function canEditOwnTrackerContent(permission: TrackerPermission | null) {
  return permission === "write";
}

export function canCreateTrackerContent(permission: TrackerPermission | null) {
  return canWriteTracker(permission);
}

export function canMutateTrackerResource(
  permission: TrackerPermission | null,
  actorUserId: string,
  createdByUserId: string | null | undefined
) {
  if (canManageTracker(permission)) {
    return true;
  }

  if (!canEditOwnTrackerContent(permission)) {
    return false;
  }

  return createdByUserId === actorUserId;
}

export async function getUserRole(userId: string): Promise<Role | null> {
  const rows = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return (rows[0]?.role as Role | undefined) ?? null;
}
