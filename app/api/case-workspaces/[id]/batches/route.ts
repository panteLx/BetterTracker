import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceManageAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import {
  listPvsSubmissionBatches,
  sendCaseFilesToPvs,
} from "@/lib/services/pvs-submission-service";
import { pvsBatchInputSchema } from "@/lib/validators/pvs-batch";
import { created, ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const wantsHidden = searchParams.get("hidden") === "true";

  const access = wantsHidden
    ? await requireCaseWorkspaceManageAccess(request.headers, id)
    : await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const items = await listPvsSubmissionBatches(id, { isHidden: wantsHidden });
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const { caseFileIds } = pvsBatchInputSchema.parse(body);

    const result = await sendCaseFilesToPvs(id, caseFileIds, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "pvs_batch_sent",
      resourceType: "pvs_submission_batch",
      resourceId: result.batch.id,
      metadata: { caseFileIds, submittedOn: result.batch.submittedOn },
      ...(await getRequestAuditContext()),
    });

    return created({ item: result.batch, caseFiles: result.caseFiles });
  } catch (error) {
    return mapServiceError(error);
  }
}
