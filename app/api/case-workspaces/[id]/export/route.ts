import { requireCaseWorkspaceManageAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { getCaseWorkspaceById } from "@/lib/case-workspaces";
import { createWorkspaceExportStream } from "@/lib/services/case-workspace-export-service";
import { notFound, mapServiceError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { toDateInputValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Full handover archive of every case file in the workspace (owner/admin only). */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceManageAccess(request.headers, id);
  if (access.response) return access.response;

  const limited = checkRateLimit(`workspace-export:${access.user!.id}`, 3, 60_000);
  if (limited) return limited;

  try {
    const workspace = await getCaseWorkspaceById(id);
    if (!workspace) return notFound("Workspace not found");

    const stream = await createWorkspaceExportStream(id, workspace.name);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_workspace_exported",
      resourceType: "case_workspace",
      resourceId: id,
      ...(await getRequestAuditContext()),
    });

    const slug = workspace.slug.replace(/[^A-Za-z0-9_-]/g, "_") || "workspace";
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Export_${slug}_${toDateInputValue(new Date())}.zip"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
