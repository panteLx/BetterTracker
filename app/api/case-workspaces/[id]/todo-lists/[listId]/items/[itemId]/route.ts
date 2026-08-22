import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { deleteTodoItem, updateTodoItem } from "@/lib/services/todo-service";
import { ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; listId: string; itemId: string }> }
) {
  const { id, listId, itemId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const updated = await updateTodoItem(
      id,
      listId,
      itemId,
      body,
      access.workspaceAccess!.permission
    );

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_item_updated",
      resourceType: "todo_item",
      resourceId: itemId,
      metadata: { workspaceId: id, listId },
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; listId: string; itemId: string }> }
) {
  const { id, listId, itemId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    await deleteTodoItem(id, listId, itemId, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_item_deleted",
      resourceType: "todo_item",
      resourceId: itemId,
      metadata: { workspaceId: id, listId },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
