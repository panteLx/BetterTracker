import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { listInvoices, uploadInvoice } from "@/lib/services/case-invoice-service";
import { invoiceUploadFieldsSchema } from "@/lib/validators/case-invoice";
import { badRequest, created, mapServiceError, ok } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    return ok({ items: await listInvoices(id) });
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
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Missing PDF file");
    if (file.type !== "application/pdf") return badRequest("Invoice must be a PDF file");

    const rawIds = form.get("caseFileIds");
    let parsedIds: unknown = [];
    if (typeof rawIds === "string" && rawIds.length > 0) {
      try {
        parsedIds = JSON.parse(rawIds);
      } catch {
        return badRequest("caseFileIds must be a JSON array");
      }
    }
    const { caseFileIds } = invoiceUploadFieldsSchema.parse({ caseFileIds: parsedIds });

    const item = await uploadInvoice(
      id,
      { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
      caseFileIds,
      access.user!.id
    );

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_invoice_uploaded",
      resourceType: "case_invoice",
      resourceId: item.id,
      metadata: { caseFileIds },
      ...(await getRequestAuditContext()),
    });

    return created({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
