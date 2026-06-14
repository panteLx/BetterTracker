import { listTrackerMemberCandidates } from "@/lib/auth/tracker-access";
import { requireTrackerMemberAccess } from "@/lib/auth/guards";
import { badRequest, ok, serverError } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireTrackerMemberAccess(request.headers, id);
  if (access.response) return access.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) {
    return badRequest("q is required");
  }

  try {
    const items = await listTrackerMemberCandidates(id, q);
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}
