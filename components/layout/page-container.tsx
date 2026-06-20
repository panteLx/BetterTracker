import { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";

type PageContainerProps = {
  children: ReactNode;
  user?: {
    name: string;
    email: string;
    role?: string | null;
  } | null;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageContainer({
  children,
  user,
  title,
  description,
  actions,
}: PageContainerProps) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 pb-28 sm:px-6 md:pb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </main>
      {user ? <MobileNav role={user.role} /> : null}
    </div>
  );
}
