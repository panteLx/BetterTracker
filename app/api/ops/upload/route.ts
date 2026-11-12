import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { replaceAnhang2, replaceHybridList } from "@/lib/services/ops-service";
import { badRequest, mapServiceError, ok } from "@/lib/http";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "anhang2" && kind !== "hybrid") return badRequest("Unknown dataset kind");
    if (!(file instanceof File)) return badRequest("Missing Excel file");
    if (!file.name.toLowerCase().endsWith(".xlsx")) return badRequest("File must be an .xlsx file");
    if (file.size > MAX_BYTES) return badRequest("File is larger than 10 MB");

    const bytes = Buffer.from(await file.arrayBuffer());
    const userId = access.user!.id;
    const dataset =
      kind === "anhang2"
        ? await replaceAnhang2(bytes, file.name, userId)
        : await replaceHybridList(bytes, file.name, userId);

    await logAuditEvent({
      actorUserId: userId,
      action: "ops_dataset_uploaded",
      resourceType: "ops_dataset",
      resourceId: kind,
      metadata: { kind, fileName: file.name, rowCount: dataset[kind === "anhang2" ? "anhang2" : "hybrid"]?.rowCount },
      ...(await getRequestAuditContext()),
    });

    return ok({ dataset });
  } catch (error) {
    return mapServiceError(error);
  }
}
