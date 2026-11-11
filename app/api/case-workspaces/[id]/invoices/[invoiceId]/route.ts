import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { deleteInvoice, getInvoice } from "@/lib/services/case-invoice-service";
import { mapServiceError, ok } from "@/lib/http";

type Context = { params: Promise<{ id: string; invoiceId: string }> };

export async function GET(request: Request, context: Context) {
  const { id, invoiceId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    return ok({ item: await getInvoice(id, invoiceId) });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id, invoiceId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    await deleteInvoice(id, invoiceId, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_invoice_deleted",
      resourceType: "case_invoice",
      resourceId: invoiceId,
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
