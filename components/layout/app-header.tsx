"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, CreditCard, ReceiptText, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { CommandPalette } from "@/components/layout/command-palette";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: CreditCard, exact: true },
  { href: "/transactions", label: "Transaktionen", icon: ReceiptText, exact: false },
  { href: "/schedules", label: "Termine", icon: TimerReset, exact: false },
  { href: "/statistics", label: "Statistiken", icon: BarChart2, exact: false },
];

type HeaderProps = {
  user?: {
    name: string;
    email: string;
    role?: string | null;
  } | null;
  registrationEnabled?: boolean;
};

export function AppHeader({ user, registrationEnabled = true }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <CreditCard className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            BetterTracker
          </span>
        </Link>

        {user ? (
          <nav className="hidden items-center gap-0.5 md:flex">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <CommandPalette role={user?.role} />
              <UserMenu name={user.name} email={user.email} role={user.role} />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              {registrationEnabled ? (
                <Button size="sm" asChild>
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
