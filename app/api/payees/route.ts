import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payees } from "@/lib/db/schema";
import { requireTrackerContentCreateAccess, requireTrackerReadAccess } from "@/lib/auth/guards";
import { badRequest, created, mapServiceError, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { payeeInputSchema } from "@/lib/validators/payee";

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
  const rawBody = await parseRequestJson<Record<string, unknown>>(request);
  const trackerId = typeof rawBody.trackerId === "string" ? rawBody.trackerId : null;
  if (!trackerId) return badRequest("trackerId is required");

  const access = await requireTrackerContentCreateAccess(request.headers, trackerId);
  if (access.response) return access.response;

  try {
    const body = payeeInputSchema.parse(rawBody);

    const [item] = await db
      .insert(payees)
      .values({
        trackerId: body.trackerId,
        name: body.name,
        notes: body.notes || null,
      })
      .returning();
    return created({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
