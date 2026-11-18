import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listAssignableCaseFiles } from "@/lib/services/case-invoice-service";
import { invoiceTypeSchema } from "@/lib/validators/case-invoice";
import { mapServiceError, ok } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const invoiceType = invoiceTypeSchema.parse(
      new URL(request.url).searchParams.get("invoiceType")
    );
    return ok({ items: await listAssignableCaseFiles(id, invoiceType) });
  } catch (error) {
    return mapServiceError(error);
  }
}
