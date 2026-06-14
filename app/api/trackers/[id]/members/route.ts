import { requireTrackerMemberAccess } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { listTrackerMembers } from "@/lib/auth/tracker-access";
import { db } from "@/lib/db";
import { trackerMembers } from "@/lib/db/schema";
import { badRequest, created, serverError, ok } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import type { TrackerPermission } from "@/lib/auth/permissions";

const ALLOWED_SHARE_PERMISSIONS: TrackerPermission[] = ["admin", "write", "read"];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireTrackerMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const items = await listTrackerMembers(id);
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireTrackerMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      userId?: string;
      permission?: TrackerPermission;
    }>(request);

    if (!body.userId || !body.permission) {
      return badRequest("userId and permission are required");
    }

    if (!ALLOWED_SHARE_PERMISSIONS.includes(body.permission)) {
      return badRequest("Invalid tracker permission");
    }

    const [item] = await db
      .insert(trackerMembers)
      .values({
        trackerId: id,
        userId: body.userId,
        permission: body.permission,
      })
      .returning();

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "tracker_member_added",
      resourceType: "tracker_member",
      resourceId: item.id,
      metadata: {
        trackerId: id,
        userId: body.userId,
        permission: body.permission,
      },
      ...(await getRequestAuditContext()),
    });

    return created({ item });
  } catch (error) {
    return serverError(error);
  }
}
