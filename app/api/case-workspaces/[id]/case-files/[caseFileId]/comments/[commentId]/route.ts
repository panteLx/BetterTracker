import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { deleteCaseFileComment } from "@/lib/services/case-file-service";
import { ok, mapServiceError } from "@/lib/http";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; caseFileId: string; commentId: string }> }
) {
  const { id, caseFileId, commentId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    await deleteCaseFileComment(caseFileId, commentId, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_file_comment_deleted",
      resourceType: "case_file_comment",
      resourceId: commentId,
      metadata: { caseFileId },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
