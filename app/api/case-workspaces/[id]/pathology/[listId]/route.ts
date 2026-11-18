import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { getPathologyList, setPathologyListArchived } from "@/lib/services/pathology-service";
import { archiveListSchema } from "@/lib/validators/pathology";
import { mapServiceError, ok, parseRequestJson } from "@/lib/http";

type Context = { params: Promise<{ id: string; listId: string }> };

export async function GET(request: Request, context: Context) {
  const { id, listId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    return ok({ item: await getPathologyList(id, listId) });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const { id, listId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const { isArchived } = archiveListSchema.parse(await parseRequestJson<unknown>(request));
    const item = await setPathologyListArchived(id, listId, isArchived);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "pathology_list_archived",
      resourceType: "pathology_list",
      resourceId: listId,
      metadata: { isArchived },
      ...(await getRequestAuditContext()),
    });

    return ok({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
