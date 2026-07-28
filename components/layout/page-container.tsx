import { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
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
  actions?: ReactNode;
  hideHeader?: boolean;
  size?: "default" | "narrow";
};

export function PageContainer({
  children,
  user,
  title,
  description,
  actions,
  hideHeader = false,
  size = "default",
}: PageContainerProps) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AppHeader user={user} />
      <main
        className={cn(
          "mx-auto flex w-full flex-col gap-4 px-4 py-4 pb-8 sm:px-6",
          size === "narrow" ? "max-w-4xl" : "max-w-7xl",
        )}
      >
        {!hideHeader && title ? (
          <PageHeader title={title} description={description} actions={actions} />
        ) : null}
        {children}
      </main>
      <AppFooter />
      {user ? <MobileNav role={user.role} /> : null}
    </div>
  );
}
