import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listPathologyLists } from "@/lib/services/pathology-service";
import { mapServiceError, ok } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
    return ok({ items: await listPathologyLists(id, includeArchived) });
  } catch (error) {
    return mapServiceError(error);
  }
}
