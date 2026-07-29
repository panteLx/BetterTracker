"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, CreditCard, ReceiptText, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  segmentedItemClass,
  segmentedTrackClass,
} from "@/components/ui/segmented";
import { UserMenu } from "@/components/layout/user-menu";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";

export const navItems = [
  { href: "/", label: "Dashboard", icon: CreditCard, exact: true },
  {
    href: "/transactions",
    label: "Buchungen",
    icon: ReceiptText,
    exact: false,
  },
  { href: "/schedules", label: "Termine", icon: TimerReset, exact: false },
  { href: "/statistics", label: "Statistik", icon: BarChart2, exact: false },
];

export function isNavItemActive(
  pathname: string,
  item: { href: string; exact: boolean },
) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

type HeaderProps = {
  user?: {
    name: string;
    email: string;
    role?: string | null;
  } | null;
  registrationEnabled?: boolean;
};

/**
 * Logo left, navigation centered, personal controls right. Centering the nav
 * keeps it equidistant from both edges however wide the window gets, and
 * leaves the two corners for the things that are about you rather than about
 * where you are.
 */
export function AppHeader({ user, registrationEnabled = true }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="h-4 w-4" />
          </span>
          <span className=" text-sm font-semibold tracking-tight inline">
            BetterTracker
          </span>
        </Link>

        {user ? (
          <nav
            aria-label="Hauptnavigation"
            className={segmentedTrackClass(
              "track",
              "absolute left-1/2 hidden -translate-x-1/2 md:inline-flex",
            )}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={segmentedItemClass({
                    variant: "track",
                    size: "sm",
                    active,
                  })}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="flex shrink-0 items-center gap-1.5">
          {user ? (
            <>
              <CommandPalette role={user.role} />
              <ThemeToggleButton />
              <UserMenu name={user.name} email={user.email} role={user.role} />
            </>
          ) : (
            <>
              <ThemeToggleButton />
              <Button variant="ghost" size="sm" shape="pill" asChild>
                <Link href="/login">Anmelden</Link>
              </Button>
              {registrationEnabled ? (
                <Button size="sm" shape="pill" asChild>
                  <Link href="/register">Registrieren</Link>
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
