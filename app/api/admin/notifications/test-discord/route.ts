import { requireAdmin } from "@/lib/auth/guards";
import { badRequest, ok, parseRequestJson, serverError } from "@/lib/http";
import { sendDiscordNotification } from "@/lib/services/discord-service";

export async function POST(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{ trackerId?: string }>(request);
    if (!body.trackerId) {
      return badRequest("Tracker is required");
    }

    const result = await sendDiscordNotification({
      type: "admin_test",
      trackerId: body.trackerId,
      title: "BetterTracker Test",
      description: "Dies ist eine Testbenachrichtigung aus dem Adminbereich.",
      createdByUserId: access.user!.id,
    });

    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}
