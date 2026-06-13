import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { notFound, ok, serverError } from "@/lib/http";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireSuperAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    if (!rows[0]) return notFound("User not found");

    await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id));

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "user_unbanned",
      resourceType: "user",
      resourceId: id,
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
