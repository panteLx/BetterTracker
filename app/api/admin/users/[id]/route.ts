import { eq } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      name?: string;
      email?: string;
      role?: "user" | "admin" | "superadmin";
    }>(request);

    const existingRows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return notFound("User not found");

    if (body.role && access.user!.role !== "superadmin") {
      return badRequest("Only superadmins can change roles");
    }

    if (existing.role !== "user" && access.user!.role !== "superadmin") {
      return badRequest("Admins can only edit regular users");
    }

    const [updated] = await db
      .update(user)
      .set({
        name: body.name?.trim() ?? existing.name,
        email: body.email?.trim() ?? existing.email,
        role: body.role ?? existing.role,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))
      .returning();

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "admin_user_updated",
      resourceType: "user",
      resourceId: id,
      metadata: body,
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireSuperAdmin(request.headers);
  if (access.response) return access.response;

  if (access.user!.id === id) {
    return forbidden("Cannot delete your own account");
  }

  try {
    const existingRows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return notFound("User not found");

    await db.delete(user).where(eq(user.id, id));

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "admin_user_deleted",
      resourceType: "user",
      resourceId: id,
      metadata: { name: existing.name, email: existing.email },
      severity: "warning",
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
