import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { deleteTodoComment } from "@/lib/services/todo-service";
import { ok, mapServiceError } from "@/lib/http";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; listId: string; itemId: string; commentId: string }> }
) {
  const { id, listId, itemId, commentId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    await deleteTodoComment(id, listId, itemId, commentId, access.workspaceAccess!.permission);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_comment_deleted",
      resourceType: "todo_comment",
      resourceId: commentId,
      metadata: { workspaceId: id, listId, itemId },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
