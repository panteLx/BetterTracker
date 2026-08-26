import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getCaseWorkspaceMemberByUser } from "@/lib/auth/case-workspace-access";
import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { caseWorkspaceMembers, caseWorkspaces } from "@/lib/db/schema";
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
    const workspaceRows = await db
      .select()
      .from(caseWorkspaces)
      .where(eq(caseWorkspaces.id, id))
      .limit(1);
    if (!workspaceRows[0]) {
      return notFound("Workspace not found");
    }

    const existing = await getCaseWorkspaceMemberByUser(id, access.user!.id);
    if (existing?.permission === "owner") {
      return badRequest(t("api.caseWorkspaceAlreadyOwned"));
    }

    let item;
    if (!existing) {
      [item] = await db
        .insert(caseWorkspaceMembers)
        .values({
          workspaceId: id,
          userId: access.user!.id,
          permission: "admin",
        })
        .returning();
    } else if (existing.permission === "read" || existing.permission === "write") {
      [item] = await db
        .update(caseWorkspaceMembers)
        .set({ permission: "admin" })
        .where(eq(caseWorkspaceMembers.id, existing.id))
        .returning();
    } else {
      item = existing;
    }

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_workspace_self_shared_by_admin",
      resourceType: "case_workspace_member",
      resourceId: item.id,
      metadata: {
        workspaceId: id,
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
