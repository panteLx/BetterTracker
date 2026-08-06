import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { addCaseFileComment, listCaseFileComments } from "@/lib/services/case-file-service";
import { created, ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; caseFileId: string }> }
) {
  const { id, caseFileId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const items = await listCaseFileComments(caseFileId);
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; caseFileId: string }> }
) {
  const { id, caseFileId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const comment = await addCaseFileComment(id, caseFileId, body, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_file_comment_added",
      resourceType: "case_file_comment",
      resourceId: comment.id,
      metadata: { caseFileId },
      ...(await getRequestAuditContext()),
    });

    return created({ item: comment });
  } catch (error) {
    return mapServiceError(error);
  }
}
