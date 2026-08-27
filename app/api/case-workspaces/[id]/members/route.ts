import { requireCaseWorkspaceMemberAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import {
  getCaseWorkspaceMemberByUser,
  listCaseWorkspaceMembers,
} from "@/lib/auth/case-workspace-access";
import { db } from "@/lib/db";
import { caseWorkspaceMembers } from "@/lib/db/schema";
import { badRequest, conflict, created, serverError, ok, parseRequestJson } from "@/lib/http";
import type { CaseWorkspacePermission } from "@/lib/auth/case-workspace-access";

const ALLOWED_SHARE_PERMISSIONS: CaseWorkspacePermission[] = ["admin", "write", "read"];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const items = await listCaseWorkspaceMembers(id);
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
  const access = await requireCaseWorkspaceMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      userId?: string;
      permission?: CaseWorkspacePermission;
    }>(request);

    if (!body.userId || !body.permission) {
      return badRequest("userId and permission are required");
    }

    if (!ALLOWED_SHARE_PERMISSIONS.includes(body.permission)) {
      return badRequest("Invalid workspace permission");
    }

    const existingMember = await getCaseWorkspaceMemberByUser(id, body.userId);
    if (existingMember) {
      return conflict("This user already has access to this workspace");
    }

    const [item] = await db
      .insert(caseWorkspaceMembers)
      .values({
        workspaceId: id,
        userId: body.userId,
        permission: body.permission,
      })
      .returning();

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_workspace_member_added",
      resourceType: "case_workspace_member",
      resourceId: item.id,
      metadata: {
        workspaceId: id,
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
