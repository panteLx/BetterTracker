import { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";

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
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_42%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-72 -z-10 h-[32rem] bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(15,23,42,0.03),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 pb-12 sm:px-6 sm:pb-16">
        <section className="flex flex-col gap-4 rounded-[1.65rem] border border-border/50 bg-card/78 p-6 shadow-sm backdrop-blur-xl md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">
              BetterTracker
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </section>
        {children}
      </main>
    </div>
  );
}
