import { requireAdmin } from "@/lib/auth/guards";
import { getSettings, setSetting, DEFAULT_SETTINGS } from "@/lib/services/admin-settings-service";
import { parseDiscordWebhookUrl } from "@/lib/validators/discord-webhook";
import { forbidden, mapServiceError, ok } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";

const SUPERADMIN_ONLY_KEYS = new Set([
  "registrationEnabled",
  "loginMessageEnabled",
  "loginMessage",
  "dashboardMessageEnabled",
  "dashboardMessage",
]);

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const settings = await getSettings();
    return ok({ settings });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<Partial<typeof DEFAULT_SETTINGS>>(request);
    for (const [key, value] of Object.entries(body)) {
      if (key in DEFAULT_SETTINGS) {
        if (SUPERADMIN_ONLY_KEYS.has(key) && access.user!.role !== "superadmin") {
          return forbidden("Only superadmins can change this setting");
        }
        // The webhook URL is dialled by the server, so it is validated on every
        // write path rather than only where it is entered.
        const nextValue =
          key === "discordWebhookUrl" && typeof value === "string"
            ? parseDiscordWebhookUrl(value)
            : value;

        await setSetting(key as keyof typeof DEFAULT_SETTINGS, nextValue, access.user!.id);
      }
    }
    const settings = await getSettings();
    return ok({ settings });
  } catch (error) {
    return mapServiceError(error);
  }
}
