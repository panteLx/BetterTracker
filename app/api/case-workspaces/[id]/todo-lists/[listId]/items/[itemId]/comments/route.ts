import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { createTodoComment, listTodoComments } from "@/lib/services/todo-service";
import { created, ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; listId: string; itemId: string }> }
) {
  const { id, listId, itemId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const items = await listTodoComments(id, listId, itemId);
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; listId: string; itemId: string }> }
) {
  const { id, listId, itemId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const comment = await createTodoComment(
      id,
      listId,
      itemId,
      body,
      access.workspaceAccess!.permission,
      access.user!.id
    );

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_comment_added",
      resourceType: "todo_comment",
      resourceId: comment.id,
      metadata: { workspaceId: id, listId, itemId },
      ...(await getRequestAuditContext()),
    });

    return created({ item: comment });
  } catch (error) {
    return mapServiceError(error);
  }
}
