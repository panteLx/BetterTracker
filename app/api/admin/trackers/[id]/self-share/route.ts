import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getTrackerMemberByUser } from "@/lib/auth/tracker-access";
import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { trackerMembers, trackers } from "@/lib/db/schema";
import { badRequest, notFound, ok, serverError } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  const t = await getTranslations("Errors");

  try {
    const trackerRows = await db.select().from(trackers).where(eq(trackers.id, id)).limit(1);
    if (!trackerRows[0]) {
      return notFound("Tracker not found");
    }

    const existing = await getTrackerMemberByUser(id, access.user!.id);
    if (existing?.permission === "owner") {
      return badRequest(t("api.trackerAlreadyOwned"));
    }

    let item;
    if (!existing) {
      [item] = await db
        .insert(trackerMembers)
        .values({
          trackerId: id,
          userId: access.user!.id,
          permission: "admin",
        })
        .returning();
    } else if (existing.permission === "read" || existing.permission === "write") {
      [item] = await db
        .update(trackerMembers)
        .set({ permission: "admin" })
        .where(eq(trackerMembers.id, existing.id))
        .returning();
    } else {
      item = existing;
    }

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "tracker_self_shared_by_admin",
      resourceType: "tracker_member",
      resourceId: item.id,
      metadata: {
        trackerId: id,
        userId: access.user!.id,
        permission: item.permission,
      },
      ...(await getRequestAuditContext()),
    });

    return ok({ item });
  } catch (error) {
    return serverError(error);
  }
}
