import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { previewPathologyImport } from "@/lib/services/pathology-service";
import { badRequest, mapServiceError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_PATHOLOGY_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  const limited = checkRateLimit(`pathology-preview:${access.user!.id}`, 10, 60_000);
  if (limited) return limited;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Missing PDF file");
    if (file.type !== "application/pdf") return badRequest("File must be a PDF");
    if (file.size === 0 || file.size > MAX_PATHOLOGY_PDF_BYTES) {
      return badRequest("PDF must be at most 10 MB");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
      return badRequest("File must be a PDF");
    }

    return ok(await previewPathologyImport(id, bytes));
  } catch (error) {
    return mapServiceError(error);
  }
}
