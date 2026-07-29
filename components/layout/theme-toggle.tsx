"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";

const options = [
  { value: "light", icon: Sun, label: "Hell" },
  { value: "dark", icon: Moon, label: "Dunkel" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

const subscribe = () => () => {};

/**
 * False on the server and during the first client render, so the markup
 * matches and next-themes can settle before we paint a selection.
 */
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** The full three-way control, including "follow the system". Lives in the profile. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <Segmented
      label="Farbmodus"
      size="sm"
      items={options.map(({ value, icon, label }) => ({ value, icon, label }))}
      value={mounted ? (theme ?? "system") : "system"}
      onValueChange={setTheme}
      className={className}
    />
  );
}

/**
 * The quick switch in the header: one press, light ⇄ dark. "System" is a
 * setup decision rather than an in-passing one, so it stays in the profile.
 */
export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      shape="pill"
      aria-label={
        isDark ? "Zu hellem Modus wechseln" : "Zu dunklem Modus wechseln"
      }
      title={isDark ? "Heller Modus" : "Dunkler Modus"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
