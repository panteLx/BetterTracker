import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { caseWorkspaceMembers, caseWorkspaces } from "@/lib/db/schema";
import { listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { requireCaseModuleApi } from "@/lib/auth/case-workspace-guards";
import { logAuditEvent, getRequestAuditContext } from "@/lib/audit-log";
import { badRequest, created, ok, serverError, parseRequestJson } from "@/lib/http";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";
import { slugify } from "@/lib/utils";

export async function GET(request: Request) {
  const authResult = await requireCaseModuleApi(request.headers);
  if (authResult.response) return authResult.response;

  try {
    const items = await listCaseWorkspacesForUser(authResult.user!.id);
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const authResult = await requireCaseModuleApi(request.headers);
  if (authResult.response) return authResult.response;

  try {
    const body = await parseRequestJson<{
      name?: string;
      description?: string | null;
      color?: string;
    }>(request);

    if (!body.name?.trim()) {
      return badRequest("Workspace name is required");
    }

    const slug = slugify(body.name);
    const [sortOrderRow] = await db
      .select({
        value: sql<number>`coalesce(max(${caseWorkspaces.sortOrder}), -1) + 1`,
      })
      .from(caseWorkspaces);
    const [workspace] = await db
      .insert(caseWorkspaces)
      .values({
        name: body.name.trim(),
        slug,
        description: body.description?.trim() || null,
        color: body.color || DEFAULT_TRACKER_COLOR,
        sortOrder: sortOrderRow?.value ?? 0,
      })
      .returning();

    await db.insert(caseWorkspaceMembers).values({
      workspaceId: workspace.id,
      userId: authResult.user!.id,
      permission: "owner",
    });

    await logAuditEvent({
      actorUserId: authResult.user!.id,
      action: "case_workspace_created",
      resourceType: "case_workspace",
      resourceId: workspace.id,
      metadata: workspace,
      ...(await getRequestAuditContext()),
    });

    return created({ item: { ...workspace, permission: "owner" as const } });
  } catch (error) {
    return serverError(error);
  }
}
