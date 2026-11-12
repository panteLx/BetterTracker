import { requireAdmin } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { getOpsOverview, updateFixedCodes } from "@/lib/services/ops-service";
import { opsFixedCodesSchema } from "@/lib/validators/ops";
import { mapServiceError, ok, parseRequestJson } from "@/lib/http";

export async function PUT(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const input = opsFixedCodesSchema.parse(await parseRequestJson(request));
    const before = (await getOpsOverview()).fixedCodes;
    const fixedCodes = await updateFixedCodes(input, access.user!.id);

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "ops_fixed_codes_updated",
      resourceType: "ops_fixed_codes",
      metadata: { before, after: fixedCodes },
      ...(await getRequestAuditContext()),
    });

    return ok({ fixedCodes });
  } catch (error) {
    return mapServiceError(error);
  }
}
