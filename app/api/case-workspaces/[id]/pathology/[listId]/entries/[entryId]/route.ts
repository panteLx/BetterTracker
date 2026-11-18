import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { updatePathologyEntry } from "@/lib/services/pathology-service";
import { updateEntrySchema } from "@/lib/validators/pathology";
import { mapServiceError, ok, parseRequestJson } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; listId: string; entryId: string }> }
) {
  const { id, listId, entryId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const patch = updateEntrySchema.parse(await parseRequestJson<unknown>(request));
    const item = await updatePathologyEntry(id, listId, entryId, patch);

    // Field names only — values are patient data.
    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "pathology_entry_updated",
      resourceType: "pathology_entry",
      resourceId: entryId,
      metadata: { fields: Object.keys(patch) },
      ...(await getRequestAuditContext()),
    });

    return ok({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
