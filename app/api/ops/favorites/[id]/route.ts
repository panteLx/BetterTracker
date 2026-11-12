import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { deleteFavorite, updateFavorite } from "@/lib/services/ops-favorite-service";
import { opsFavoriteSchema } from "@/lib/validators/ops";
import { mapServiceError, ok, parseRequestJson } from "@/lib/http";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const item = await updateFavorite(id, opsFavoriteSchema.parse(await parseRequestJson(request)));
    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "ops_favorite_updated",
      resourceType: "ops_favorite",
      resourceId: id,
      metadata: item,
      ...(await getRequestAuditContext()),
    });
    return ok({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    await deleteFavorite(id);
    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "ops_favorite_deleted",
      resourceType: "ops_favorite",
      resourceId: id,
      ...(await getRequestAuditContext()),
    });
    return ok({ ok: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
