import { and, eq } from "drizzle-orm";
import type { TrackerPermission } from "@/lib/auth/permissions";
import { getTrackerMember } from "@/lib/auth/tracker-access";
import { requireTrackerMemberAccess } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { trackerMembers } from "@/lib/db/schema";
import { badRequest, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";

const ALLOWED_SHARE_PERMISSIONS: TrackerPermission[] = ["admin", "write", "read"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await context.params;
  const access = await requireTrackerMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const member = await getTrackerMember(memberId);
    if (!member || member.trackerId !== id) {
      return notFound("Tracker member not found");
    }

    if (member.permission === "owner") {
      return badRequest("Tracker owner cannot be changed");
    }

    const body = await parseRequestJson<{ permission?: TrackerPermission }>(request);
    if (!body.permission || !ALLOWED_SHARE_PERMISSIONS.includes(body.permission)) {
      return badRequest("Invalid tracker permission");
    }

    const [updated] = await db
      .update(trackerMembers)
      .set({ permission: body.permission })
      .where(and(eq(trackerMembers.id, memberId), eq(trackerMembers.trackerId, id)))
      .returning();

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "tracker_member_updated",
      resourceType: "tracker_member",
      resourceId: memberId,
      metadata: {
        trackerId: id,
        userId: member.userId,
        permission: body.permission,
      },
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await context.params;
  const access = await requireTrackerMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const member = await getTrackerMember(memberId);
    if (!member || member.trackerId !== id) {
      return notFound("Tracker member not found");
    }

    if (member.permission === "owner") {
      return badRequest("Tracker owner cannot be removed");
    }

    await db
      .delete(trackerMembers)
      .where(and(eq(trackerMembers.id, memberId), eq(trackerMembers.trackerId, id)));

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "tracker_member_removed",
      resourceType: "tracker_member",
      resourceId: memberId,
      metadata: {
        trackerId: id,
        userId: member.userId,
        previousPermission: member.permission,
      },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
