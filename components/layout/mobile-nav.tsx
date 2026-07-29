"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, isNavItemActive } from "@/components/layout/app-header";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";

/**
 * Bottom bar for phones: two destinations, the primary action, two more
 * destinations. Same four destinations as the desktop header — the order is
 * split around the center button rather than reshuffled, so the two layouts
 * stay learnable as one.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);

  function renderItem(item: (typeof navItems)[number]) {
    const Icon = item.icon;
    const active = isNavItemActive(pathname, item);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="flex flex-col items-center justify-center py-2"
      >
        <span
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors duration-(--motion-duration-fast)",
            active
              ? "bg-primary-subtle text-primary-on"
              : "text-muted-foreground",
          )}
        >
          <Icon
            className={cn("h-5 w-5", active ? "stroke-[2.5]" : "stroke-[1.75]")}
          />
          <span className="font-subtext text-[10px] font-medium">
            {item.label}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <>
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {navItems.slice(0, 2).map(renderItem)}

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-label="Neue Buchung erfassen"
              className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors duration-(--motion-duration-fast) hover:bg-primary-hover"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {navItems.slice(2).map(renderItem)}
        </div>
      </nav>

      <QuickAddSheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
