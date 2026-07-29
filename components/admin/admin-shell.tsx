import { type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Two-column frame for every admin page: navigation parked on the left so it
 * stays put while you move between sections, content on the right.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <AdminNav />
      </aside>
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
