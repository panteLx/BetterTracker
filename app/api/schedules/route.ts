import { createSchedule, listSchedules } from "@/lib/services/schedule-service";
import { badRequest, created, mapServiceError, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { requireTrackerContentCreateAccess, requireTrackerReadAccess } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackerId = searchParams.get("trackerId");
  const status = searchParams.get("status") || undefined;
  if (!trackerId) return badRequest("trackerId is required");

  const access = await requireTrackerReadAccess(request.headers, trackerId);
  if (access.response) return access.response;

  try {
    const items = await listSchedules(trackerId, status, access.user!.id, access.trackerAccess!.permission);
    return ok({ items });
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
    const item = await createSchedule(body, access.user!.id);
    return created({ item });
  } catch (error) {
    return mapServiceError(error);
  }
}
