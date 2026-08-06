import { listCaseWorkspaceMemberCandidates } from "@/lib/auth/case-workspace-access";
import { requireCaseWorkspaceMemberAccess } from "@/lib/auth/case-workspace-guards";
import { badRequest, ok, serverError } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceMemberAccess(request.headers, id);
  if (access.response) return access.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) {
    return badRequest("q is required");
  }

  try {
    const items = await listCaseWorkspaceMemberCandidates(id, q);
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}
