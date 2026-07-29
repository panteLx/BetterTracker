import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { requireTrackerContentCreateAccess, requireTrackerReadAccess } from "@/lib/auth/guards";
import { badRequest, created, mapServiceError, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { categoryInputSchema } from "@/lib/validators/category";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackerId = searchParams.get("trackerId");
  if (!trackerId) return badRequest("trackerId is required");

  const access = await requireTrackerReadAccess(request.headers, trackerId);
  if (access.response) return access.response;

  try {
    const items = await db
      .select()
      .from(categories)
      .where(eq(categories.trackerId, trackerId))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

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
    const body = categoryInputSchema.parse(rawBody);

    const [item] = await db
      .insert(categories)
      .values({
        trackerId: body.trackerId,
        name: body.name,
        type: body.type || "expense",
        color: body.color || "#0f766e",
      })
      .returning();

    return created({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
