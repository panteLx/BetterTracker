import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { getInvoiceFile } from "@/lib/services/case-invoice-service";
import { mapServiceError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const { id, invoiceId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  const limited = checkRateLimit(`invoice-file:${access.user!.id}`, 60, 60_000);
  if (limited) return limited;

  try {
    const { name, bytes } = await getInvoiceFile(id, invoiceId);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
