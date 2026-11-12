import { requireAdmin } from "@/lib/auth/guards";
import { requireCaseModuleApi } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { createFavorite, listFavorites } from "@/lib/services/ops-favorite-service";
import { opsFavoriteSchema } from "@/lib/validators/ops";
import { created, mapServiceError, ok, parseRequestJson } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireCaseModuleApi(request.headers);
  if (access.response) return access.response;

  try {
    return ok({ items: await listFavorites() });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const item = await createFavorite(opsFavoriteSchema.parse(await parseRequestJson(request)));
    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "ops_favorite_created",
      resourceType: "ops_favorite",
      resourceId: item.id,
      metadata: item,
      ...(await getRequestAuditContext()),
    });
    return created({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
