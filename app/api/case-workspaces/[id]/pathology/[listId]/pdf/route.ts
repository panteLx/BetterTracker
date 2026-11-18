import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { getPathologyList } from "@/lib/services/pathology-service";
import { renderPathologyListPdf } from "@/lib/services/pdf/render-pathology-pdf";
import { mapServiceError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; listId: string }> }
) {
  const { id, listId } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  const limited = checkRateLimit(`pathology-pdf:${access.user!.id}`, 30, 60_000);
  if (limited) return limited;

  try {
    const list = await getPathologyList(id, listId);
    const buffer = await renderPathologyListPdf(list);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "pathology_list_exported",
      resourceType: "pathology_list",
      resourceId: listId,
      metadata: { entryCount: list.entryCount },
      ...(await getRequestAuditContext()),
    });

    const name = `Patientenliste_${list.periodStart}_${list.periodEnd}.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
