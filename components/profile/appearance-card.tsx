"use client";

import { useTranslations } from "next-intl";
import { SectionCard } from "@/components/ui/section-card";
import { MicroLabel } from "@/components/ui/micro-label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ACCENT_SCHEMES,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  applyAccentScheme,
  isAccentScheme,
  storeAccentScheme,
  type AccentScheme,
  type AccentSchemeId,
} from "@/lib/appearance";
import { useLocalStorageValue } from "@/hooks/use-local-storage-value";
import { cn } from "@/lib/utils";

/**
 * Each scheme is a different color in light and dark, so the swatch shows the
 * one that is actually in effect. Two elements toggled by the dark variant
 * rather than one: the value has to come from inline style, which no CSS
 * variant can reach into.
 */
function AccentSwatch({
  swatch,
  selected,
}: {
  swatch: AccentScheme["swatch"];
  selected: boolean;
}) {
  const shared = cn(
    "h-5 w-5 rounded-full",
    selected && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
  );

  return (
    <>
      <span
        aria-hidden
        className={cn(shared, "dark:hidden")}
        style={{ backgroundColor: swatch.light }}
      />
      <span
        aria-hidden
        className={cn(shared, "hidden dark:block")}
        style={{ backgroundColor: swatch.dark }}
      />
    </>
  );
}

/**
 * Color mode and accent, together in one place — they are the same decision
 * to a person, even though two different mechanisms carry them.
 *
 * Both are stored per device (see lib/appearance.ts). The accent has already
 * been applied to <html> by the boot script, so this component is only a
 * mirror of localStorage — it never owns the value.
 */
export function AppearanceCard() {
  const t = useTranslations("Profile.appearance");
  const stored = useLocalStorageValue(ACCENT_STORAGE_KEY);
  const accent: AccentSchemeId = isAccentScheme(stored) ? stored : DEFAULT_ACCENT;

  function selectAccent(id: AccentSchemeId) {
    storeAccentScheme(id);
    applyAccentScheme(id);
  }

  return (
    <SectionCard title={t("title")}>
      <div className="space-y-5">
        <div className="space-y-2">
          <MicroLabel>{t("colorMode")}</MicroLabel>
          <ThemeToggle />
        </div>

        <div className="space-y-2">
          <MicroLabel>{t("accentColor")}</MicroLabel>
          <p className="font-subtext text-sm text-muted-foreground">
            {t("accentDescription")}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {ACCENT_SCHEMES.map((scheme) => {
              const selected = scheme.id === accent;

              return (
                <button
                  key={scheme.id}
                  type="button"
                  onClick={() => selectAccent(scheme.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-center gap-2.5 rounded-pill border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-colors duration-(--motion-duration-fast)",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected
                      ? "border-border-strong bg-accent text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <AccentSwatch swatch={scheme.swatch} selected={selected} />
                  {scheme.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
