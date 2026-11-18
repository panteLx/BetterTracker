import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listInsurerSuggestions } from "@/lib/services/pathology-service";
import { mapServiceError, ok } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    return ok({ items: await listInsurerSuggestions(id) });
  } catch (error) {
    return mapServiceError(error);
  }
}
