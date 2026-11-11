import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listAssignableCaseFiles } from "@/lib/services/case-invoice-service";
import { mapServiceError, ok } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    return ok({ items: await listAssignableCaseFiles(id) });
  } catch (error) {
    return mapServiceError(error);
  }
}
