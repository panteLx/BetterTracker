import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { moveTodoItem } from "@/lib/services/todo-service";
import { ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; listId: string; itemId: string }> }
) {
  const { id, listId, itemId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    await moveTodoItem(id, listId, itemId, body, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_item_moved",
      resourceType: "todo_item",
      resourceId: itemId,
      metadata: { workspaceId: id, sourceListId: listId },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
