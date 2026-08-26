import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account as accountTable, session as sessionTable, user as userTable } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { canAccessCaseModule, canAccessTrackerModule } from "@/lib/auth/permissions";

export async function getServerSession() {
  const headerStore = await headers();
  return auth.api.getSession({
    headers: headerStore,
  });
}

export async function requireUser() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

// Gates the finance module: falls back to the cases module (or the
// dedicated no-access page when neither module is reachable) when a user's
// per-user module access was revoked by an admin, so redirecting never
// lands on another blocked page.
export async function requireTrackerModuleUser() {
  const user = await requireUser();
  if (canAccessTrackerModule(user)) {
    return user;
  }
  redirect(canAccessCaseModule(user) ? "/cases" : "/no-access");
}

export async function requireCaseModuleUser() {
  const user = await requireUser();
  if (canAccessCaseModule(user)) {
    return user;
  }
  redirect(canAccessTrackerModule(user) ? "/" : "/no-access");
}

export async function requireApiUser(requestHeaders: Headers) {
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    return null;
  }

  if (session.user.banned) {
    return null;
  }

  return session.user;
}

export async function revokeUserSessions(userId: string) {
  return db.delete(sessionTable).where(eq(sessionTable.userId, userId));
}

export async function getActiveSessionsForUser(userId: string) {
  return db
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.userId, userId),
        gt(sessionTable.expiresAt, new Date())
      )
    );
}

export async function getCurrentUserRecord(userId: string) {
  const rows = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function hasCredentialAccount(userId: string) {
  const rows = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(eq(accountTable.userId, userId), eq(accountTable.providerId, "credential"))
    )
    .limit(1);

  return rows.length > 0;
}
