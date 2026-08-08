import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listCaseFileIds, type CaseFileFilters } from "@/lib/services/case-file-service";
import { ok, mapServiceError } from "@/lib/http";

/**
 * Backs the board's "select all N matching" bulk-selection action — returns
 * every id matching the given filters (capped), independent of the paginated
 * list's PAGE_SIZE.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const filters: CaseFileFilters = {
      status: (searchParams.get("status") as CaseFileFilters["status"]) || undefined,
      caseType: (searchParams.get("caseType") as CaseFileFilters["caseType"]) || undefined,
      batchId: searchParams.get("batchId") || undefined,
      q: searchParams.get("q") || undefined,
      submittedFrom: searchParams.get("submittedFrom") || undefined,
      submittedTo: searchParams.get("submittedTo") || undefined,
    };

    const ids = await listCaseFileIds(id, filters);
    return ok({ ids });
  } catch (error) {
    return mapServiceError(error);
  }
}
