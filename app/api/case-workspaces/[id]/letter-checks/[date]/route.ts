import { requireCaseWorkspaceContentCreateAccess } from "@/lib/auth/case-workspace-guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { setLetterCheck } from "@/lib/services/letter-check-service";
import { isoDateSchema } from "@/lib/validators/letter-check";
import { ok, mapServiceError, parseRequestJson } from "@/lib/http";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; date: string }> }
) {
  const { id, date } = await context.params;
  const access = await requireCaseWorkspaceContentCreateAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<unknown>(request);
    const result = await setLetterCheck(id, isoDateSchema.parse(date), body, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: result.checked ? "letter_check_set" : "letter_check_cleared",
      resourceType: "letter_check",
      resourceId: `${id}:${date}`,
      metadata: { workspaceId: id, date },
      ...(await getRequestAuditContext()),
    });

    return ok({ item: result });
  } catch (error) {
    return mapServiceError(error);
  }
}
