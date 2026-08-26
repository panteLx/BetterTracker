import { type ElementType, type ReactNode } from "react";
import { CasesHeader } from "@/components/layout/cases-header";
import { AppFooter } from "@/components/layout/app-footer";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type CasesPageContainerProps = {
  children: ReactNode;
  user?: {
    name: string;
    email: string;
    role?: string | null;
    canAccessTrackers?: boolean | null;
    canAccessCases?: boolean | null;
  } | null;
  workspaceId?: string;
  title?: string;
  description?: string;
  icon?: ElementType;
  actions?: ReactNode;
  hideHeader?: boolean;
  size?: "default" | "narrow";
};

/**
 * Parallel shell to PageContainer, for the standalone cases module. No
 * MobileNav/QuickAddFab — there is no single "add one thing fast" analog
 * here the way there is for transactions; primary actions live in the
 * table/header of each page instead.
 */
export function CasesPageContainer({
  children,
  user,
  workspaceId,
  title,
  description,
  icon,
  actions,
  hideHeader = false,
  size = "default",
}: CasesPageContainerProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <CasesHeader user={user} workspaceId={workspaceId} />
      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 pb-10 sm:px-6 sm:py-8",
          size === "narrow" ? "max-w-4xl" : "max-w-7xl"
        )}
      >
        {!hideHeader && title ? (
          <PageHeader title={title} description={description} icon={icon} actions={actions} />
        ) : null}
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
