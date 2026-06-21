import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { notFound, ok } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  const rows = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      slug: trackers.slug,
      description: trackers.description,
      color: trackers.color,
      currency: trackers.currency,
      isActive: trackers.isActive,
    })
    .from(trackers)
    .where(and(eq(trackers.slug, slug), eq(trackers.isPublic, true), eq(trackers.isHidden, false)))
    .limit(1);

  const tracker = rows[0];
  if (!tracker) return notFound("Tracker not found or not public");

  return ok({ item: tracker });
}
