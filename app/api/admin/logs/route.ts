import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { auditLogs, user } from "@/lib/db/schema";
import { ok, serverError } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const severity = searchParams.get("severity");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const actor = searchParams.get("actor");

    const filters = [];
    if (action) filters.push(like(auditLogs.action, `%${action}%`));
    if (severity) filters.push(eq(auditLogs.severity, severity as typeof auditLogs.severity.enumValues[number]));
    if (from) filters.push(gte(auditLogs.createdAt, new Date(from)));
    if (to) filters.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59`)));
    if (actor) filters.push(like(user.email, `%${actor}%`));

    const items = await db
      .select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        actorUserName: user.name,
        actorUserEmail: user.email,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        severity: auditLogs.severity,
        metadataJson: auditLogs.metadataJson,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(user, eq(user.id, auditLogs.actorUserId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(500);

    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  const access = await requireSuperAdmin(request.headers);
  if (access.response) return access.response;

  try {
    await db.delete(auditLogs);
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
