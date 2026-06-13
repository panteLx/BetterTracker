import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { ok, serverError } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const items = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(asc(user.createdAt));

    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}
