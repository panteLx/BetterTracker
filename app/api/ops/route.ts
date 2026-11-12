import { requireCaseModuleApi } from "@/lib/auth/case-workspace-guards";
import { getOpsOverview, searchOps } from "@/lib/services/ops-service";
import { opsSearchQuerySchema } from "@/lib/validators/ops";
import { mapServiceError, ok } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireCaseModuleApi(request.headers);
  if (access.response) return access.response;

  try {
    const { q } = opsSearchQuerySchema.parse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    });
    const [search, overview] = await Promise.all([searchOps(q), getOpsOverview()]);
    return ok({ ...search, ...overview });
  } catch (error) {
    return mapServiceError(error);
  }
}
