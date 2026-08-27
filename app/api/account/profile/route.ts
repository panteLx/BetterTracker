import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuthenticatedApi } from "@/lib/auth/guards";
import {
  getCurrentUserRecord,
  hasCredentialAccount,
  verifyUserPassword,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  badRequest,
  conflict,
  forbidden,
  mapServiceError,
  ok,
  parseRequestJson,
} from "@/lib/http";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(320)),
    currentPassword: z.string().min(1).optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  const access = await requireAuthenticatedApi(request.headers);
  if (access.response) return access.response;

  try {
    const body = profileUpdateSchema.parse(await parseRequestJson<unknown>(request));
    const { name, email } = body;
    const userId = access.user!.id;

    const current = await getCurrentUserRecord(userId);
    const isEmailChange = Boolean(current) && email !== current!.email;

    // The email address is the login identity, so changing it is a credential
    // change: a momentary hold on a session must not be enough to move the
    // account to an address the owner does not control. Accounts that sign in
    // through OIDC have no password to check against.
    if (isEmailChange && (await hasCredentialAccount(userId))) {
      if (!body.currentPassword) {
        return badRequest("Enter your current password to change your email address");
      }

      if (!(await verifyUserPassword(userId, body.currentPassword))) {
        return forbidden("Current password is incorrect");
      }
    }

    const conflicting = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, email), ne(user.id, userId)))
      .limit(1);
    if (conflicting[0]) {
      return conflict("Email is already in use");
    }

    await db
      .update(user)
      .set({ name, email, updatedAt: new Date() })
      .where(eq(user.id, userId));

    await logAuditEvent({
      actorUserId: userId,
      action: "user_profile_updated",
      resourceType: "user",
      resourceId: userId,
      severity: isEmailChange ? "warning" : "info",
      metadata: { name, email, emailChanged: isEmailChange },
      ...(await getRequestAuditContext()),
    });

    return ok({ success: true });
  } catch (error) {
    return mapServiceError(error);
  }
}
