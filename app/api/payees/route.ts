import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payees } from "@/lib/db/schema";
import { requireTrackerContentCreateAccess, requireTrackerReadAccess } from "@/lib/auth/guards";
import { badRequest, created, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackerId = searchParams.get("trackerId");
  if (!trackerId) return badRequest("trackerId is required");

  const access = await requireTrackerReadAccess(request.headers, trackerId);
  if (access.response) return access.response;

  try {
    const items = await db
      .select()
      .from(payees)
      .where(eq(payees.trackerId, trackerId))
      .orderBy(asc(payees.name));
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const body = await parseRequestJson<{
    trackerId?: string;
    name?: string;
    notes?: string | null;
  }>(request);

  if (!body.trackerId || !body.name?.trim()) {
    return badRequest("trackerId and name are required");
  }

  const access = await requireTrackerContentCreateAccess(request.headers, body.trackerId);
  if (access.response) return access.response;

  try {
    const [item] = await db
      .insert(payees)
      .values({
        trackerId: body.trackerId,
        name: body.name.trim(),
        notes: body.notes?.trim() || null,
      })
      .returning();
    return created({ item });
  } catch (error) {
    return serverError(error);
  }
}
