import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { account, user } from "@/lib/db/schema";
import { ok, serverError } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const [items, credentialAccounts] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          banExpires: user.banExpires,
          canAccessTrackers: user.canAccessTrackers,
          canAccessCases: user.canAccessCases,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(asc(user.createdAt)),
      db
        .select({ userId: account.userId })
        .from(account)
        .where(eq(account.providerId, "credential")),
    ]);

    const usersWithPassword = new Set(credentialAccounts.map((row) => row.userId));

    return ok({
      items: items.map((item) => ({
        ...item,
        hasPassword: usersWithPassword.has(item.id),
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}
