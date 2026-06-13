import { NextResponse } from "next/server";
import { getTrackerPermission, canReadTracker, canWriteTracker, isAdminRole, isSuperAdminRole } from "@/lib/auth/permissions";
import { requireApiUser } from "@/lib/auth/session";

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

  if (isAdminRole(authResult.user.role)) {
    return authResult;
  }

  const permission = await getTrackerPermission(trackerId, authResult.user.id);
  if (!canReadTracker(permission)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return authResult;
}

export async function requireTrackerWriteAccess(headers: Headers, trackerId: string) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  if (isAdminRole(authResult.user.role)) {
    return authResult;
  }

  const permission = await getTrackerPermission(trackerId, authResult.user.id);
  if (!canWriteTracker(permission)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
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
