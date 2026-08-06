import { and, eq } from "drizzle-orm";
import type { CaseWorkspacePermission } from "@/lib/auth/case-workspace-access";
import { getCaseWorkspaceMember } from "@/lib/auth/case-workspace-access";
import { requireCaseWorkspaceMemberAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { caseWorkspaceMembers } from "@/lib/db/schema";
import { badRequest, notFound, ok, serverError, parseRequestJson } from "@/lib/http";

const ALLOWED_SHARE_PERMISSIONS: CaseWorkspacePermission[] = ["admin", "write", "read"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await context.params;
  const access = await requireCaseWorkspaceMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const member = await getCaseWorkspaceMember(memberId);
    if (!member || member.workspaceId !== id) {
      return notFound("Workspace member not found");
    }

    if (member.permission === "owner") {
      return badRequest("Workspace owner cannot be changed");
    }

    const body = await parseRequestJson<{ permission?: CaseWorkspacePermission }>(request);
    if (!body.permission || !ALLOWED_SHARE_PERMISSIONS.includes(body.permission)) {
      return badRequest("Invalid workspace permission");
    }

    const [updated] = await db
      .update(caseWorkspaceMembers)
      .set({ permission: body.permission })
      .where(and(eq(caseWorkspaceMembers.id, memberId), eq(caseWorkspaceMembers.workspaceId, id)))
      .returning();

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_workspace_member_updated",
      resourceType: "case_workspace_member",
      resourceId: memberId,
      metadata: {
        workspaceId: id,
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
  const access = await requireCaseWorkspaceMemberAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const member = await getCaseWorkspaceMember(memberId);
    if (!member || member.workspaceId !== id) {
      return notFound("Workspace member not found");
    }

    if (member.permission === "owner") {
      return badRequest("Workspace owner cannot be removed");
    }

    await db
      .delete(caseWorkspaceMembers)
      .where(and(eq(caseWorkspaceMembers.id, memberId), eq(caseWorkspaceMembers.workspaceId, id)));

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_workspace_member_removed",
      resourceType: "case_workspace_member",
      resourceId: memberId,
      metadata: {
        workspaceId: id,
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
