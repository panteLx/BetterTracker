"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, CalendarClock, Home, Plus, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";

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
        <div className="grid h-16 grid-cols-5 items-center">
          {/* First 2 nav items */}
          {navItems.slice(0, 2).map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-0.5 py-2"
              >
                <span
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-all",
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
              className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 active:scale-95"
            >
              <Plus className="h-6 w-6" />
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
                className="flex flex-col items-center justify-center gap-0.5 py-2"
              >
                <span
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-all",
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

      <QuickAddSheet open={fabOpen} onOpenChange={setFabOpen} />
    </>
  );
}
