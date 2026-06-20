"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ReceiptText, CalendarClock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const baseItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/transactions", label: "Buchungen", icon: ReceiptText },
  { href: "/schedules", label: "Termine", icon: CalendarClock },
];

type MobileNavProps = {
  role?: string | null;
};

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    ...baseItems,
    ...(role === "admin" || role === "superadmin"
      ? [{ href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={cn(
          "grid h-14",
          items.length === 4 ? "grid-cols-4" : "grid-cols-3",
        )}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-all",
                  isActive ? "stroke-[2.5]" : "stroke-[1.75]",
                )}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
