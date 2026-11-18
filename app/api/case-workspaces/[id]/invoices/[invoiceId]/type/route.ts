import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { setInvoiceType } from "@/lib/services/case-invoice-service";
import { setInvoiceTypeSchema } from "@/lib/validators/case-invoice";
import { mapServiceError, ok, parseRequestJson } from "@/lib/http";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const { id, invoiceId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const { invoiceType } = setInvoiceTypeSchema.parse(body);

    const item = await setInvoiceType(id, invoiceId, invoiceType);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_invoice_type_set",
      resourceType: "case_invoice",
      resourceId: invoiceId,
      metadata: { invoiceType },
      ...(await getRequestAuditContext()),
    });

    return ok({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
