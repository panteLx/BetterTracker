import {
  requireCaseWorkspaceContentCreateAccess,
  requireCaseWorkspaceReadAccess,
} from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import {
  createCaseFile,
  listCaseFiles,
  type CaseFileFilters,
} from "@/lib/services/case-file-service";
import { created, ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const filters: CaseFileFilters = {
      status: (searchParams.get("status") as CaseFileFilters["status"]) || undefined,
      caseType: (searchParams.get("caseType") as CaseFileFilters["caseType"]) || undefined,
      batchId: searchParams.get("batchId") || undefined,
      q: searchParams.get("q") || undefined,
      month: searchParams.get("month") || undefined,
    };

    const items = await listCaseFiles(id, filters, access.workspaceAccess!.permission);
    return ok({ items });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const caseFile = await createCaseFile(id, body, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "case_file_created",
      resourceType: "case_file",
      resourceId: caseFile.id,
      metadata: caseFile,
      ...(await getRequestAuditContext()),
    });

    return created({ item: caseFile });
  } catch (error) {
    return mapServiceError(error);
  }
}
