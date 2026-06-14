import { createTransaction, listTransactions } from "@/lib/services/transaction-service";
import { badRequest, created, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { requireTrackerContentCreateAccess, requireTrackerReadAccess } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackerId = searchParams.get("trackerId");
  if (!trackerId) return badRequest("trackerId is required");

  const access = await requireTrackerReadAccess(request.headers, trackerId);
  if (access.response) return access.response;

  try {
    const data = await listTransactions({
      trackerId,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      payeeId: searchParams.get("payeeId") || undefined,
      direction: searchParams.get("direction") || undefined,
      q: searchParams.get("q") || undefined,
    }, access.user!.id, access.trackerAccess!.permission);

    return ok(data);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const body = await parseRequestJson<Record<string, unknown>>(request);
  const trackerId = typeof body.trackerId === "string" ? body.trackerId : null;
  if (!trackerId) return badRequest("trackerId is required");

  const access = await requireTrackerContentCreateAccess(request.headers, trackerId);
  if (access.response) return access.response;

  try {
    const item = await createTransaction(body, access.user!.id);
    return created({ item });
  } catch (error) {
    return serverError(error);
  }
}
