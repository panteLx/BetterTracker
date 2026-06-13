import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { badRequest, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { revokeUserSessions } from "@/lib/auth/session";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireSuperAdmin(request.headers);
  if (access.response) return access.response;

  if (id === access.user!.id) {
    return badRequest("You cannot ban yourself");
  }

  try {
    const body = await parseRequestJson<{ reason?: string; expiresAt?: string | null }>(request);
    const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    const target = rows[0];
    if (!target) return notFound("User not found");

    await db
      .update(user)
      .set({
        banned: true,
        banReason: body.reason?.trim() || "Banned by admin",
        banExpires: body.expiresAt ? new Date(body.expiresAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id));

    await revokeUserSessions(id);
    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "user_banned",
      resourceType: "user",
      resourceId: id,
      metadata: body,
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
