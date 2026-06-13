import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, trackerMembers, trackers } from "@/lib/db/schema";
import { requireAuthenticatedApi } from "@/lib/auth/guards";
import { logAuditEvent, getRequestAuditContext } from "@/lib/audit-log";
import { badRequest, created, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { slugify } from "@/lib/utils";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedApi(request.headers);
  if (authResult.response) return authResult.response;

  try {
    const items =
      authResult.user!.role === "user"
        ? await db
            .select({
              id: trackers.id,
              name: trackers.name,
              slug: trackers.slug,
              description: trackers.description,
              color: trackers.color,
              currency: trackers.currency,
              isActive: trackers.isActive,
              sortOrder: trackers.sortOrder,
              permission: trackerMembers.permission,
            })
            .from(trackers)
            .innerJoin(trackerMembers, eq(trackers.id, trackerMembers.trackerId))
            .where(eq(trackerMembers.userId, authResult.user!.id))
            .orderBy(asc(trackers.sortOrder), asc(trackers.name))
        : await db
            .select({
              id: trackers.id,
              name: trackers.name,
              slug: trackers.slug,
              description: trackers.description,
              color: trackers.color,
              currency: trackers.currency,
              isActive: trackers.isActive,
              sortOrder: trackers.sortOrder,
            })
            .from(trackers)
            .orderBy(asc(trackers.sortOrder), asc(trackers.name));

    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedApi(request.headers);
  if (authResult.response) return authResult.response;

  try {
    const body = await parseRequestJson<{
      name?: string;
      description?: string | null;
      color?: string;
      currency?: string;
    }>(request);

    if (!body.name?.trim()) {
      return badRequest("Tracker name is required");
    }

    const slug = slugify(body.name);
    const [tracker] = await db
      .insert(trackers)
      .values({
        name: body.name.trim(),
        slug,
        description: body.description?.trim() || null,
        color: body.color || "#0f766e",
        currency: body.currency || "EUR",
      })
      .returning();

    await db.insert(trackerMembers).values({
      trackerId: tracker.id,
      userId: authResult.user!.id,
      permission: "owner",
    });

    await db.insert(categories).values([
      {
        trackerId: tracker.id,
        name: "Lebensmittel",
        type: "expense",
        color: "#475569",
        sortOrder: 0,
      },
      {
        trackerId: tracker.id,
        name: "Kaffee",
        type: "expense",
        color: "#92400e",
        sortOrder: 1,
      },
      {
        trackerId: tracker.id,
        name: "Abo",
        type: "expense",
        color: "#7c3aed",
        sortOrder: 2,
      },
      {
        trackerId: tracker.id,
        name: "Haushalt",
        type: "expense",
        color: "#2563eb",
        sortOrder: 3,
      },
      {
        trackerId: tracker.id,
        name: "Freizeit",
        type: "expense",
        color: "#db2777",
        sortOrder: 4,
      },
      {
        trackerId: tracker.id,
        name: "Einnahmen",
        type: "income",
        color: "#059669",
        sortOrder: 5,
      },
      {
        trackerId: tracker.id,
        name: "Rueckerstattung",
        type: "income",
        color: "#16a34a",
        sortOrder: 6,
      },
    ]);

    await logAuditEvent({
      actorUserId: authResult.user!.id,
      action: "tracker_created",
      resourceType: "tracker",
      resourceId: tracker.id,
      metadata: tracker,
      ...(await getRequestAuditContext()),
    });

    return created({ item: tracker });
  } catch (error) {
    return serverError(error);
  }
}
