import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import {
  buildCaseWorkspaceUpdateValues,
  type CaseWorkspaceUpdateInput,
} from "@/lib/case-workspaces";
import { db } from "@/lib/db";
import { caseWorkspaces } from "@/lib/db/schema";
import { notFound, ok, parseRequestJson, serverError } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<CaseWorkspaceUpdateInput>(request);

    const [updated] = await db
      .update(caseWorkspaces)
      .set(buildCaseWorkspaceUpdateValues(body))
      .where(eq(caseWorkspaces.id, id))
      .returning();

    if (!updated) {
      return notFound("Workspace not found");
    }

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "admin_case_workspace_updated",
      resourceType: "case_workspace",
      resourceId: id,
      metadata: body,
      ...(await getRequestAuditContext()),
    });

    return ok({ item: updated });
  } catch (error) {
    return serverError(error);
  }
}
