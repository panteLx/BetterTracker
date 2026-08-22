import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { createTodoList, listTodoLists } from "@/lib/services/todo-service";
import { created, ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const wantsArchived = searchParams.get("archived") === "true";
    const items = await listTodoLists(id, { isArchived: wantsArchived });
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const list = await createTodoList(id, body, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "todo_list_created",
      resourceType: "todo_list",
      resourceId: list.id,
      metadata: { workspaceId: id },
      ...(await getRequestAuditContext()),
    });

    return created({ item: list });
  } catch (error) {
    return mapServiceError(error);
  }
}
