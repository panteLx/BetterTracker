import { requireCaseModuleApi } from "@/lib/auth/case-workspace-guards";
import { getOpsOverview, searchOps } from "@/lib/services/ops-service";
import { opsSearchQuerySchema } from "@/lib/validators/ops";
import { mapServiceError, ok } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireCaseModuleApi(request.headers);
  if (access.response) return access.response;

  try {
    const params = new URL(request.url).searchParams;
    const { q, hideHybrid, hideNo115b } = opsSearchQuerySchema.parse({
      q: params.get("q") ?? "",
      hideHybrid: params.get("hideHybrid") ?? undefined,
      hideNo115b: params.get("hideNo115b") ?? undefined,
    });
    const [search, overview] = await Promise.all([
      searchOps(q, { hideHybrid: hideHybrid === "1", hideNo115b: hideNo115b === "1" }),
      getOpsOverview(),
    ]);
    return ok({ ...search, ...overview });
  } catch (error) {
    return mapServiceError(error);
  }
}
