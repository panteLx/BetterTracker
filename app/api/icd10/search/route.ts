import { requireCaseModuleApi } from "@/lib/auth/case-workspace-guards";
import { ok, serverError } from "@/lib/http";
import { searchIcd10Codes } from "@/lib/services/icd10-service";

export async function GET(request: Request) {
  const authResult = await requireCaseModuleApi(request.headers);
  if (authResult.response) return authResult.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const items = await searchIcd10Codes(query);
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}
