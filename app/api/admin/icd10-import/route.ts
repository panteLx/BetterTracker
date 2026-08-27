import { requireAdmin } from "@/lib/auth/guards";
import { getAuditContextFromHeaders, logAuditEvent } from "@/lib/audit-log";
import { getIcd10ImportStatus } from "@/lib/services/icd10-service";
import { importIcd10FromZip } from "@/lib/services/icd10-import-service";
import { badRequest, mapServiceError, ok } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const status = await getIcd10ImportStatus();
    return ok(status);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  let file: FormDataEntryValue | null;
  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return badRequest("Request body is not a valid multipart upload");
  }
  if (!(file instanceof File)) {
    return badRequest("No file uploaded");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importIcd10FromZip(buffer);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "icd10.import",
      resourceType: "icd10_codes",
      severity: "warning",
      metadata: { fileName: file.name, ...result },
      ...getAuditContextFromHeaders(request.headers),
    });

    return ok(result);
  } catch (error) {
    return mapServiceError(error);
  }
}
