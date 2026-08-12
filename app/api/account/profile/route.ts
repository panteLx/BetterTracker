import { and, eq, ne } from "drizzle-orm";
import { requireAuthenticatedApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { badRequest, conflict, ok, parseRequestJson, serverError } from "@/lib/http";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";

export async function PATCH(request: Request) {
  const access = await requireAuthenticatedApi(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{ name?: string; email?: string }>(request);
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!name || !email) {
      return badRequest("Name and email are required");
    }

    const conflicting = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, email), ne(user.id, access.user!.id)))
      .limit(1);
    if (conflicting[0]) {
      return conflict("Email is already in use");
    }

    await db
      .update(user)
      .set({ name, email, updatedAt: new Date() })
      .where(eq(user.id, access.user!.id));

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "user_profile_updated",
      resourceType: "user",
      resourceId: access.user!.id,
      metadata: { name, email },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
