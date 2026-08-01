import { env } from "@/lib/env";

export type Locale = "de-DE" | "en-US";

export type LocaleOption = {
  code: Locale;
  label: string;
};

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: "de-DE", label: "Deutsch" },
  { code: "en-US", label: "English" },
];

const LOCALE_CODES = SUPPORTED_LOCALES.map((locale) => locale.code);

export const DEFAULT_LOCALE: Locale = isSupportedLocale(env.defaultLocale)
  ? env.defaultLocale
  : "en-US";

export const LOCALE_COOKIE = "bettertracker.locale";

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALE_CODES.includes(value as Locale);
}
