"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookSearch, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/client-fetch";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";
import { workspaceNavItems, isWorkspaceNavItemActive } from "@/components/layout/cases-header";

type CaseWorkspace = {
  id: string;
  isActive: boolean;
  permission: "owner" | "admin" | "write" | "read";
};

/**
 * Bottom bar for phones, parallel to the finance module's MobileNav: same
 * destinations as the desktop header nav (minus settings, which lives in the user menu on mobile), split 2/2 around a center
 * "new case file" button. That deep-links to the board with `?new=case`,
 * the same query param the desktop command palette uses to pop the create
 * sheet open (see case-board-client.tsx) — so this works from any tab. The
 * `["case-workspaces"]` query shares its cache with the board page and
 * command palette, so this rarely costs an extra request.
 */
export function CasesMobileNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const t = useTranslations("Cases.nav");
  const navItemsAria = useTranslations("Nav")("ariaMainNav");
  const [lookupOpen, setLookupOpen] = useState(false);
  const allItems = workspaceNavItems(workspaceId);
  const navItems = allItems.filter(
    (item) => item.key !== "settings" && item.key !== "ops" && item.key !== "pathology",
  );
  // OPS and pathology share one slot so the bar stays 2 + FAB + 2.
  const lookupItems = allItems.filter((item) => item.key === "ops" || item.key === "pathology");
  const lookupActive = lookupItems.some((item) => isWorkspaceNavItemActive(pathname, item));

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canCreate = workspace
    ? canWriteWorkspace(workspace.permission) && workspace.isActive
    : false;

  function renderItem(item: (typeof navItems)[number]) {
    const Icon = item.icon;
    const active = isWorkspaceNavItemActive(pathname, item);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={t(item.key)}
        className="flex min-w-0 items-center justify-center py-2"
      >
        <span
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 transition-colors duration-(--motion-duration-fast)",
            active ? "bg-primary-subtle text-primary-on" : "text-muted-foreground",
          )}
        >
          <Icon className={cn("h-5 w-5", active ? "stroke-[2.5]" : "stroke-[1.75]")} />
          <span className={cn("font-subtext text-[10px] font-medium", active ? "whitespace-nowrap" : "sr-only")}>
            {t(item.key)}
          </span>
        </span>
      </Link>
    );
  }

  function renderLookup() {
    return (
      <Popover open={lookupOpen} onOpenChange={setLookupOpen}>
        <PopoverTrigger
          aria-label={t("lookup")}
          className="flex min-w-0 items-center justify-center py-2"
        >
          <span
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 transition-colors duration-(--motion-duration-fast)",
              lookupActive ? "bg-primary-subtle text-primary-on" : "text-muted-foreground",
            )}
          >
            <BookSearch className={cn("h-5 w-5", lookupActive ? "stroke-[2.5]" : "stroke-[1.75]")} />
            <span className={cn("font-subtext text-[10px] font-medium", lookupActive ? "whitespace-nowrap" : "sr-only")}>
              {t("lookup")}
            </span>
          </span>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-44 p-1">
          {lookupItems.map((item) => {
            const Icon = item.icon;
            const active = isWorkspaceNavItemActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setLookupOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-3 py-2.5 text-sm",
                  active ? "bg-primary-subtle text-primary-on" : "text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <nav
      aria-label={navItemsAria}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center">
        <div className="grid grid-cols-2">{navItems.slice(0, 2).map(renderItem)}</div>

        <div className="flex items-center justify-center">
          {canCreate ? (
            <Link
              href={`/cases/${workspaceId}?new=case`}
              aria-label={t("newCaseFileAria")}
              className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors duration-(--motion-duration-fast) hover:bg-primary-hover"
            >
              <Plus className="h-6 w-6" />
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-2">
          {navItems.slice(2).map(renderItem)}
          {renderLookup()}
        </div>
      </div>
    </nav>
  );
}
