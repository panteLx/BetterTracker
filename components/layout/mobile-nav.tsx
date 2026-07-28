"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, CalendarClock, Home, Plus, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home, exact: true },
  { href: "/transactions", label: "Buchungen", icon: ReceiptText, exact: false },
  { href: "/schedules", label: "Termine", icon: CalendarClock, exact: false },
  { href: "/statistics", label: "Statistik", icon: BarChart2, exact: false },
];

type MobileNavProps = {
  role?: string | null;
};

export function MobileNav({}: MobileNavProps) {
  const pathname = usePathname();
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/92 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-14 grid-cols-5 items-center">
          {/* First 2 nav items */}
          {navItems.slice(0, 2).map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-0.5 py-1"
              >
                <span
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", isActive ? "stroke-[2.5]" : "stroke-[1.75]")}
                  />
                  <span className="text-[10px] font-medium">{label}</span>
                </span>
              </Link>
            );
          })}

          {/* Center FAB */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setFabOpen(true)}
              aria-label="Neue Buchung erstellen"
              className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Last 2 nav items */}
          {navItems.slice(2).map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-0.5 py-1"
              >
                <span
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", isActive ? "stroke-[2.5]" : "stroke-[1.75]")}
                  />
                  <span className="text-[10px] font-medium">{label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Global FAB Sheet — redirect to dashboard for now; dashboard handles the full form */}
      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto mt-0 mb-3 h-1 w-10 rounded-full bg-muted" />
          <SheetTitle className="sr-only">Schnellzugriff</SheetTitle>
          <SheetDescription className="sr-only">Wähle eine Aktion</SheetDescription>
          <div className="flex flex-col gap-2 pb-2">
            <p className="text-sm font-semibold mb-2">Schnellzugriff</p>
            <Link
              href="/"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-sm font-medium transition hover:bg-muted"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              Neue Buchung (Dashboard)
            </Link>
            <Link
              href="/schedules"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-sm font-medium transition hover:bg-muted"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
              Neuer Termin
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
