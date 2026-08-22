import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { createTodoItem } from "@/lib/services/todo-service";
import { created, mapServiceError, parseRequestJson } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; listId: string }> }
) {
  const { id, listId } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const item = await createTodoItem(
      id,
      listId,
      body,
      access.workspaceAccess!.permission,
      access.user!.id
    );

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_item_created",
      resourceType: "todo_item",
      resourceId: item.id,
      metadata: { workspaceId: id, listId },
      ...(await getRequestAuditContext()),
    });

    return created({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
