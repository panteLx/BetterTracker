export type Role = "user" | "admin" | "superadmin";
export type TrackerPermission = "owner" | "admin" | "write" | "read";

export function isAdminRole(role?: string | null): role is "admin" | "superadmin" {
  return role === "admin" || role === "superadmin";
}

export function isSuperAdminRole(role?: string | null): role is "superadmin" {
  return role === "superadmin";
}

export function canAccessTrackerModule(user: { canAccessTrackers?: boolean | null }) {
  return user.canAccessTrackers !== false;
}

export function canAccessCaseModule(user: { canAccessCases?: boolean | null }) {
  return user.canAccessCases !== false;
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


