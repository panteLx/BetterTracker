/**
 * Accent scheme handling.
 *
 * The accent is one of the few things a user can change about the look. Like
 * the light/dark choice (owned by next-themes) it lives in localStorage and is
 * therefore per device, not per account — there is no per-user settings table,
 * `appSettings` is global and admin-only. If the accent should ever follow a
 * user across devices, this module is the single place that reads and writes
 * it, so only the two storage helpers below would change.
 *
 * The token values themselves live in `app/globals.css` under
 * `[data-scheme="…"]`. Here we only decide which attribute goes on <html>.
 */

export const ACCENT_STORAGE_KEY = "bettertracker.accent";

export type AccentSchemeId =
  | "mono"
  | "teal"
  | "indigo"
  | "rose"
  | "amber"
  | "violet";

export type AccentScheme = {
  id: AccentSchemeId;
  label: string;
  /** Representative color for the picker dot, per color mode. */
  swatch: { light: string; dark: string };
};

/** "mono" is the default and deliberately sets no attribute at all. */
export const DEFAULT_ACCENT: AccentSchemeId = "mono";

export const ACCENT_SCHEMES: AccentScheme[] = [
  { id: "mono", label: "Monochrom", swatch: { light: "#111827", dark: "#e4e4e7" } },
  { id: "teal", label: "Petrol", swatch: { light: "#0d9488", dark: "#14b8a6" } },
  { id: "indigo", label: "Indigo", swatch: { light: "#4f46e5", dark: "#6366f1" } },
  { id: "rose", label: "Rosé", swatch: { light: "#e11d48", dark: "#f43f5e" } },
  { id: "amber", label: "Bernstein", swatch: { light: "#d97706", dark: "#f59e0b" } },
  { id: "violet", label: "Violett", swatch: { light: "#7c3aed", dark: "#8b5cf6" } },
];

const SCHEME_IDS = ACCENT_SCHEMES.map((scheme) => scheme.id);

export function isAccentScheme(value: unknown): value is AccentSchemeId {
  return typeof value === "string" && SCHEME_IDS.includes(value as AccentSchemeId);
}

export function applyAccentScheme(id: AccentSchemeId) {
  const root = document.documentElement;

  if (id === DEFAULT_ACCENT) {
    root.removeAttribute("data-scheme");
    return;
  }

  root.setAttribute("data-scheme", id);
}

export function readStoredAccentScheme(): AccentSchemeId {
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentScheme(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    // Private mode or blocked storage — fall back to the default.
    return DEFAULT_ACCENT;
  }
}

export function storeAccentScheme(id: AccentSchemeId) {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, id);
  } catch {
    // Non-fatal: the accent still applies for this session.
  }
}

/**
 * Replays the stored accent before first paint. Rendered as a plain inline
 * <script> in the document head — the same trick next-themes uses for the
 * .dark class. `next/script` with strategy="beforeInteractive" is explicitly
 * documented as *not* blocking paint, so it would still flash.
 */
export const ACCENT_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  ACCENT_STORAGE_KEY,
)});if(s&&s!==${JSON.stringify(DEFAULT_ACCENT)}&&${JSON.stringify(
  SCHEME_IDS,
)}.indexOf(s)>-1){document.documentElement.setAttribute("data-scheme",s)}}catch(e){}})()`;
