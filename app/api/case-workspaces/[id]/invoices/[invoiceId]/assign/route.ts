import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { assignCaseFiles } from "@/lib/services/case-invoice-service";
import { caseFileIdsInputSchema } from "@/lib/validators/case-file-bulk";
import { mapServiceError, ok, parseRequestJson } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const { id, invoiceId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const { caseFileIds } = caseFileIdsInputSchema.parse(body);

    const item = await assignCaseFiles(id, invoiceId, caseFileIds, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_invoice_assigned",
      resourceType: "case_invoice",
      resourceId: invoiceId,
      metadata: { caseFileIds },
      ...(await getRequestAuditContext()),
    });

    return ok({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
