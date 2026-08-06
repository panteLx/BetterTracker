import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { caseWorkspaces } from "@/lib/db/schema";
import { requireCaseWorkspaceManageAccess } from "@/lib/auth/case-workspace-guards";
import { notFound, ok, serverError, parseRequestJson } from "@/lib/http";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import {
  buildCaseWorkspaceUpdateValues,
  getCaseWorkspaceById,
  type CaseWorkspaceUpdateInput,
} from "@/lib/case-workspaces";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceManageAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<CaseWorkspaceUpdateInput>(request);

    const current = await getCaseWorkspaceById(id);
    if (!current) return notFound("Workspace not found");

    const updateValues = buildCaseWorkspaceUpdateValues(body);

    const [updated] = await db
      .update(caseWorkspaces)
      .set(updateValues)
      .where(eq(caseWorkspaces.id, id))
      .returning();

    if (!updated) return notFound("Workspace not found");

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_workspace_updated",
      resourceType: "case_workspace",
      resourceId: id,
      metadata: updateValues,
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceManageAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const [deleted] = await db.delete(caseWorkspaces).where(eq(caseWorkspaces.id, id)).returning();
    if (!deleted) return notFound("Workspace not found");

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_workspace_deleted",
      resourceType: "case_workspace",
      resourceId: id,
      metadata: { name: deleted.name },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
