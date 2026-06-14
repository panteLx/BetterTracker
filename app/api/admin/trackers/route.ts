import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { ok, serverError } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const items = await db
      .select()
      .from(trackers)
      .orderBy(asc(trackers.sortOrder), asc(trackers.name));

    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}
