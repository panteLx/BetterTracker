"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClipboardList, FileStack, FolderClock, ListChecks, Settings } from "lucide-react";
import {
  segmentedItemClass,
  segmentedTrackClass,
} from "@/components/ui/segmented";
import { UserMenu } from "@/components/layout/user-menu";
import { ModuleSwitcher } from "@/components/layout/module-switcher";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";
import { CasesCommandPalette } from "@/components/cases/cases-command-palette";
import { Icd10SearchDialog } from "@/components/cases/icd10-search-dialog";

type CasesHeaderProps = {
  user?: {
    name: string;
    email: string;
    role?: string | null;
    canAccessTrackers?: boolean | null;
    canAccessCases?: boolean | null;
  } | null;
  workspaceId?: string;
};

export function workspaceNavItems(workspaceId: string) {
  return [
    { href: `/cases/${workspaceId}`, key: "board" as const, icon: ClipboardList, exact: true },
    { href: `/cases/${workspaceId}/todos`, key: "todos" as const, icon: ListChecks, exact: false },
    { href: `/cases/${workspaceId}/batches`, key: "batches" as const, icon: FolderClock, exact: false },
    { href: `/cases/${workspaceId}/settings`, key: "settings" as const, icon: Settings, exact: false },
  ];
}

export function isWorkspaceNavItemActive(
  pathname: string,
  item: { href: string; exact: boolean },
) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * Structural mirror of AppHeader (logo left, nav centered, personal controls
 * right) so the two modules don't read as visually unrelated apps. Kept as
 * its own component rather than parameterizing AppHeader because the nav
 * items are workspace-scoped and only exist once a workspace is selected.
 */
export function CasesHeader({ user, workspaceId }: CasesHeaderProps) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const navT = useTranslations("Cases.nav");
  const navItems = workspaceId ? workspaceNavItems(workspaceId) : [];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/cases" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileStack className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight inline">
            {t("moduleSwitcher.cases")}
          </span>
        </Link>

        {user && workspaceId ? (
          <nav
            aria-label={t("ariaMainNav")}
            className={segmentedTrackClass(
              "track",
              "absolute left-1/2 hidden -translate-x-1/2 md:inline-flex",
            )}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isWorkspaceNavItemActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={segmentedItemClass({ variant: "track", size: "sm", active })}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {navT(item.key)}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="flex shrink-0 items-center gap-1.5">
          {user ? (
            <>
              <CasesCommandPalette workspaceId={workspaceId} />
              <Icd10SearchDialog />
              <ModuleSwitcher
                canAccessTrackers={user.canAccessTrackers ?? true}
                canAccessCases={user.canAccessCases ?? true}
              />
              <ThemeToggleButton />
              <UserMenu name={user.name} email={user.email} role={user.role} />
            </>
          ) : (
            <ThemeToggleButton />
          )}
        </div>
      </div>
    </header>
  );
}
