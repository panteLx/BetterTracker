"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileStack } from "lucide-react";
import {
  segmentedItemClass,
  segmentedTrackClass,
} from "@/components/ui/segmented";
import { UserMenu } from "@/components/layout/user-menu";
import { ModuleSwitcher } from "@/components/layout/module-switcher";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";
import { CasesCommandPalette } from "@/components/cases/cases-command-palette";

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

function useWorkspaceNavItems(workspaceId: string) {
  const t = useTranslations("Cases.nav");
  return [
    { href: `/cases/${workspaceId}`, key: "board" as const, exact: true },
    { href: `/cases/${workspaceId}/todos`, key: "todos" as const, exact: false },
    { href: `/cases/${workspaceId}/batches`, key: "batches" as const, exact: false },
    { href: `/cases/${workspaceId}/settings`, key: "settings" as const, exact: false },
  ].map((item) => ({ ...item, label: t(item.key) }));
}

export function CasesHeader({ user, workspaceId }: CasesHeaderProps) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const navItems = useWorkspaceNavItems(workspaceId ?? "");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/cases" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileStack className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight inline">
            {t("moduleSwitcher.cases")}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5">
          {user ? (
            <>
              <CasesCommandPalette workspaceId={workspaceId} />
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

      {user && workspaceId ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6">
          <nav aria-label={t("ariaMainNav")} className={segmentedTrackClass("track")}>
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={segmentedItemClass({ variant: "track", size: "sm", active })}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
