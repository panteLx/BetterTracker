import { ElementType, ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickAddFab } from "@/components/layout/quick-add-fab";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  user?: {
    name: string;
    email: string;
    role?: string | null;
  } | null;
  title?: string;
  description?: string;
  icon?: ElementType;
  actions?: ReactNode;
  hideHeader?: boolean;
  size?: "default" | "narrow";
  /** Signed-in pages get the floating quick-add; public ones don't. */
  hideQuickAdd?: boolean;
};

export function PageContainer({
  children,
  user,
  title,
  description,
  icon,
  actions,
  hideHeader = false,
  size = "default",
  hideQuickAdd = false,
}: PageContainerProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <AppHeader user={user} />
      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 pb-10 sm:px-6 sm:py-8",
          size === "narrow" ? "max-w-4xl" : "max-w-7xl",
        )}
      >
        {!hideHeader && title ? (
          <PageHeader
            title={title}
            description={description}
            icon={icon}
            actions={actions}
          />
        ) : null}
        {children}
      </main>
      <AppFooter />
      {user ? <MobileNav /> : null}
      {user && !hideQuickAdd ? <QuickAddFab /> : null}
    </div>
  );
}
