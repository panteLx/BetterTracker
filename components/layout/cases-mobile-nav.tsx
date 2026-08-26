"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
 * four destinations as the desktop header nav, split 2/2 around a center
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
  const navItems = workspaceNavItems(workspaceId);

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
        className="flex flex-col items-center justify-center py-2"
      >
        <span
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors duration-(--motion-duration-fast)",
            active ? "bg-primary-subtle text-primary-on" : "text-muted-foreground",
          )}
        >
          <Icon className={cn("h-5 w-5", active ? "stroke-[2.5]" : "stroke-[1.75]")} />
          <span className="font-subtext text-[10px] font-medium">{t(item.key)}</span>
        </span>
      </Link>
    );
  }

  return (
    <nav
      aria-label={navItemsAria}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-5 items-center">
        {navItems.slice(0, 2).map(renderItem)}

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

        {navItems.slice(2).map(renderItem)}
      </div>
    </nav>
  );
}
