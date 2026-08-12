import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/guards";
import { hasCredentialAccount, revokeUserSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { badRequest, notFound, ok, parseRequestJson, serverError } from "@/lib/http";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{ newPassword?: string }>(request);
    const newPassword = body.newPassword ?? "";

    if (
      newPassword.length < MIN_PASSWORD_LENGTH ||
      newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      return badRequest(
        `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`
      );
    }

    const existingRows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return notFound("User not found");

    if (existing.role !== "user" && access.user!.role !== "superadmin") {
      return badRequest("Admins can only edit regular users");
    }

    if (!(await hasCredentialAccount(id))) {
      return badRequest("This user signs in via SSO and has no password to reset");
    }

    await auth.api.setUserPassword({
      headers: request.headers,
      body: { userId: id, newPassword },
    });

    await revokeUserSessions(id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "admin_user_password_reset",
      resourceType: "user",
      resourceId: id,
      severity: "warning",
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
