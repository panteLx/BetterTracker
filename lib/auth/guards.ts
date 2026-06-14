import { NextResponse } from "next/server";
import {
  canCreateTrackerContent,
  canManageTracker,
  canManageTrackerMembers,
  canManageTrackerReferenceData,
  isAdminRole,
  isSuperAdminRole,
} from "@/lib/auth/permissions";
import { requireApiUser } from "@/lib/auth/session";
import { getTrackerAccessForUser } from "@/lib/auth/tracker-access";
import { forbidden } from "@/lib/http";

type TrackerAccessOptions = {
  includeHidden?: boolean;
};

export async function requireAuthenticatedApi(headers: Headers) {
  const sessionUser = await requireApiUser(headers);
  if (!sessionUser) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: sessionUser, response: null };
}

async function loadTrackerAccess(headers: Headers, trackerId: string, options?: TrackerAccessOptions) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  const access = await getTrackerAccessForUser(trackerId, authResult.user.id, options);
  if (!access) {
    return {
      user: null,
      response: NextResponse.json({ error: "Tracker not found" }, { status: 404 }),
    };
  }

  return { user: authResult.user, trackerAccess: access, response: null };
}

export async function requireTrackerReadAccess(headers: Headers, trackerId: string) {
  const result = await loadTrackerAccess(headers, trackerId);
  if (result.response || !result.user || !result.trackerAccess) {
    return result;
  }

  return result;
}

export async function requireTrackerContentCreateAccess(
  headers: Headers,
  trackerId: string
) {
  const result = await loadTrackerAccess(headers, trackerId);
  if (result.response || !result.user || !result.trackerAccess) {
    return result;
  }

  if (!canCreateTrackerContent(result.trackerAccess.permission)) {
    return { user: null, response: forbidden() };
  }

  if (!result.trackerAccess.tracker.isActive) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Tracker is archived and cannot be modified" },
        { status: 409 }
      ),
    };
  }

  return result;
}

export async function requireTrackerManageAccess(headers: Headers, trackerId: string) {
  const result = await loadTrackerAccess(headers, trackerId, { includeHidden: true });
  if (result.response || !result.user || !result.trackerAccess) {
    return result;
  }

  if (!canManageTracker(result.trackerAccess.permission)) {
    return { user: null, response: forbidden() };
  }

  return result;
}

export async function requireTrackerMemberAccess(headers: Headers, trackerId: string) {
  const result = await loadTrackerAccess(headers, trackerId, { includeHidden: true });
  if (result.response || !result.user || !result.trackerAccess) {
    return result;
  }

  if (!canManageTrackerMembers(result.trackerAccess.permission)) {
    return { user: null, response: forbidden() };
  }

  return result;
}

export async function requireTrackerReferenceManageAccess(headers: Headers, trackerId: string) {
  const result = await loadTrackerAccess(headers, trackerId);
  if (result.response || !result.user || !result.trackerAccess) {
    return result;
  }

  if (!canManageTrackerReferenceData(result.trackerAccess.permission)) {
    return { user: null, response: forbidden() };
  }

  if (!result.trackerAccess.tracker.isActive) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Tracker is archived and cannot be modified" },
        { status: 409 }
      ),
    };
  }

  return result;
}

export async function requireAdmin(headers: Headers) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  if (!isAdminRole(authResult.user.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return authResult;
}

export async function requireSuperAdmin(headers: Headers) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  if (!isSuperAdminRole(authResult.user.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return authResult;
}
