import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { commitPathologyImport } from "@/lib/services/pathology-service";
import { commitImportSchema } from "@/lib/validators/pathology";
import { created, mapServiceError, parseRequestJson } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const input = commitImportSchema.parse(await parseRequestJson<unknown>(request));
    const result = await commitPathologyImport(id, input, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "pathology_list_imported",
      resourceType: "pathology_list",
      resourceId: result.list.id,
      metadata: { importedCount: result.importedCount, skippedCount: result.skippedCount },
      ...(await getRequestAuditContext()),
    });

    return created(result);
  } catch (error) {
    return mapServiceError(error);
  }
}
