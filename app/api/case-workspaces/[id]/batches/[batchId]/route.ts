import {
  requireCaseWorkspaceManageAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import {
  getPvsSubmissionBatchDetail,
  setPvsSubmissionBatchHidden,
} from "@/lib/services/pvs-submission-service";
import { pvsBatchVisibilityInputSchema } from "@/lib/validators/pvs-batch";
import { ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; batchId: string }> }
) {
  const { id, batchId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const detail = await getPvsSubmissionBatchDetail(id, batchId);
    return ok(detail);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; batchId: string }> }
) {
  const { id, batchId } = await context.params;
  const access = await requireCaseWorkspaceManageAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const { isHidden } = pvsBatchVisibilityInputSchema.parse(body);

    const updated = await setPvsSubmissionBatchHidden(id, batchId, isHidden);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: isHidden ? "pvs_batch_hidden" : "pvs_batch_unhidden",
      resourceType: "pvs_submission_batch",
      resourceId: batchId,
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return mapServiceError(error);
  }
}
