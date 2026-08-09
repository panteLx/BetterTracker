import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { bulkMarkReturned } from "@/lib/services/case-file-service";
import { caseFileIdsInputSchema } from "@/lib/validators/case-file-bulk";
import { ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const { caseFileIds } = caseFileIdsInputSchema.parse(body);

    const items = await bulkMarkReturned(id, caseFileIds, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_files_marked_returned",
      resourceType: "case_file",
      metadata: { caseFileIds },
      ...(await getRequestAuditContext()),
    });

    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}
