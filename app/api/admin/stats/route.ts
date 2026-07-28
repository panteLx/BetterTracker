import { requireAdmin } from "@/lib/auth/guards";
import { getAdminStats } from "@/lib/services/admin-stats-service";
import { ok, serverError } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    return ok(await getAdminStats());
  } catch (error) {
    return serverError(error);
  }
}
