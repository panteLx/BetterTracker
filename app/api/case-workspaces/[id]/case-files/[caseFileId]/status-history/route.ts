import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listCaseFileStatusHistory } from "@/lib/services/case-file-service";
import { ok, mapServiceError } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; caseFileId: string }> }
) {
  const { id, caseFileId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const items = await listCaseFileStatusHistory(caseFileId);
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}
