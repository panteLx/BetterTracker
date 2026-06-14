import { NextResponse } from "next/server";
import { isAdminRole, isSuperAdminRole } from "@/lib/auth/permissions";
import { requireApiUser } from "@/lib/auth/session";
import { getTrackerById } from "@/lib/trackers";

type TrackerWriteAccessOptions = {
  allowArchived?: boolean;
};

export async function requireAuthenticatedApi(headers: Headers) {
  const sessionUser = await requireApiUser(headers);
  if (!sessionUser) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: sessionUser, response: null };
}

export async function requireTrackerReadAccess(headers: Headers, trackerId: string) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  const tracker = await getTrackerById(trackerId);
  if (!tracker) {
    return {
      user: null,
      response: NextResponse.json({ error: "Tracker not found" }, { status: 404 }),
    };
  }

  if (isAdminRole(authResult.user.role)) {
    return authResult;
  }

  if (tracker.isHidden) {
    return {
      user: null,
      response: NextResponse.json({ error: "Tracker not found" }, { status: 404 }),
    };
  }

  return authResult;
}

export async function requireTrackerWriteAccess(
  headers: Headers,
  trackerId: string,
  options?: TrackerWriteAccessOptions
) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  const tracker = await getTrackerById(trackerId);
  if (!tracker) {
    return {
      user: null,
      response: NextResponse.json({ error: "Tracker not found" }, { status: 404 }),
    };
  }

  if (!tracker.isActive && !options?.allowArchived) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Tracker is archived and cannot be modified" },
        { status: 409 }
      ),
    };
  }

  if (isAdminRole(authResult.user.role)) {
    return authResult;
  }

  if (tracker.isHidden) {
    return {
      user: null,
      response: NextResponse.json({ error: "Tracker not found" }, { status: 404 }),
    };
  }

  return authResult;
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
