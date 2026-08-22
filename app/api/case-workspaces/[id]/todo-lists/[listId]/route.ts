import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { deleteTodoList, updateTodoList } from "@/lib/services/todo-service";
import { ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; listId: string }> }
) {
  const { id, listId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{ name?: string; isArchived?: boolean }>(request);
    const updated = await updateTodoList(id, listId, body, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action:
        body.isArchived === true
          ? "todo_list_archived"
          : body.isArchived === false
            ? "todo_list_unarchived"
            : "todo_list_renamed",
      resourceType: "todo_list",
      resourceId: listId,
      metadata: { workspaceId: id },
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; listId: string }> }
) {
  const { id, listId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    await deleteTodoList(id, listId, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_list_deleted",
      resourceType: "todo_list",
      resourceId: listId,
      metadata: { workspaceId: id },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
