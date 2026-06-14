import { requireTrackerReadAccess } from "@/lib/auth/guards";
import { badRequest, ok, serverError } from "@/lib/http";
import { getScheduleForecast } from "@/lib/services/schedule-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackerId = searchParams.get("trackerId");
  const daysParam = searchParams.get("days");

  if (!trackerId) {
    return badRequest("trackerId is required");
  }

  const access = await requireTrackerReadAccess(request.headers, trackerId);
  if (access.response) {
    return access.response;
  }

  const parsedDays = daysParam ? Number.parseInt(daysParam, 10) : 14;
  if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
    return badRequest("days must be a positive integer");
  }

  try {
    const data = await getScheduleForecast(trackerId, parsedDays);
    return ok(data);
  } catch (error) {
    return serverError(error);
  }
}
