import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listLetterChecks } from "@/lib/services/letter-check-service";
import { ok, mapServiceError } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const items = await listLetterChecks(id, {
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
    });
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}
