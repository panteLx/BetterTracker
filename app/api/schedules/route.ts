import { createSchedule, listSchedules } from "@/lib/services/schedule-service";
import { badRequest, conflict, created, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { requireTrackerContentCreateAccess, requireTrackerReadAccess } from "@/lib/auth/guards";

function mapScheduleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  const isZodError =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ZodError";

  if (isZodError) {
    return badRequest(message);
  }

  if (message.includes("archived")) {
    return conflict(message);
  }

  if (
    message.includes("Invalid schedule amount") ||
    message.includes("not found in tracker") ||
    message.includes("does not match the selected direction") ||
    message.includes("Unrecognized key") ||
    message.includes("Payee is required") ||
    message.includes("Category is required")
  ) {
    return badRequest(message);
  }

  return serverError(error);
}

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
    return mapScheduleError(error);
  }
}
