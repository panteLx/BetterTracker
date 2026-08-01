import { cookies } from "next/headers";
import { badRequest, ok } from "@/lib/http";
import { LOCALE_COOKIE, isSupportedLocale } from "@/lib/i18n/config";

export async function POST(request: Request) {
  const body = (await request.json()) as { locale?: unknown };

  if (!isSupportedLocale(body.locale)) {
    return badRequest("Unsupported locale");
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, body.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return ok({ locale: body.locale });
}
