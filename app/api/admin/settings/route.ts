import { requireAdmin } from "@/lib/auth/guards";
import { getSettings, setSetting, DEFAULT_SETTINGS } from "@/lib/services/admin-settings-service";
import { forbidden, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";

export async function GET(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const settings = await getSettings();
    return ok({ settings });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(request.headers);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<Partial<typeof DEFAULT_SETTINGS>>(request);
    for (const [key, value] of Object.entries(body)) {
      if (key in DEFAULT_SETTINGS) {
        if (key === "registrationEnabled" && access.user!.role !== "superadmin") {
          return forbidden("Only superadmins can change registration settings");
        }
        await setSetting(key as keyof typeof DEFAULT_SETTINGS, value, access.user!.id);
      }
    }
    const settings = await getSettings();
    return ok({ settings });
  } catch (error) {
    return serverError(error);
  }
}
