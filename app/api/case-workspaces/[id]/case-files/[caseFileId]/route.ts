import {
  requireCaseWorkspaceContentCreateAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { deleteCaseFile, updateCaseFile } from "@/lib/services/case-file-service";
import { ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; caseFileId: string }> }
) {
  const { id, caseFileId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const updated = await updateCaseFile(id, caseFileId, body, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_file_updated",
      resourceType: "case_file",
      resourceId: caseFileId,
      metadata: updated,
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; caseFileId: string }> }
) {
  const { id, caseFileId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    await deleteCaseFile(id, caseFileId, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_file_deleted",
      resourceType: "case_file",
      resourceId: caseFileId,
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
