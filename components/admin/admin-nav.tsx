"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { MicroLabel } from "@/components/ui/micro-label";
import { cn } from "@/lib/utils";

/**
 * Grouped so the list says what kind of thing each entry is: the first group
 * is about people and their data, the second is about the installation itself.
 */
const adminGroups = [
  {
    groupKey: "management",
    links: [
      { href: "/admin", labelKey: "overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/users", labelKey: "users", icon: Users, exact: false },
      { href: "/admin/trackers", labelKey: "trackers", icon: Shield, exact: false },
    ],
  },
  {
    groupKey: "system",
    links: [
      {
        href: "/admin/settings",
        labelKey: "settings",
        icon: Settings,
        exact: false,
      },
      { href: "/admin/logs", labelKey: "logs", icon: FileText, exact: false },
    ],
  },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("Admin.nav");

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav aria-label={t("ariaLabel")}>
      {/* Phones get a single scrollable row — a sidebar would eat the screen. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
        {adminGroups.flatMap((group) =>
          group.links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href, link.exact);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors duration-(--motion-duration-fast)",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(`links.${link.labelKey}`)}
              </Link>
            );
          }),
        )}
      </div>

      <div className="hidden space-y-5 lg:block">
        {adminGroups.map((group) => (
          <div key={group.groupKey} className="space-y-1">
            <MicroLabel className="px-3 pb-1">
              {t(`groups.${group.groupKey}`)}
            </MicroLabel>
            {group.links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href, link.exact);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-(--motion-duration-fast)",
                    active
                      ? "bg-primary-subtle text-primary-on"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(`links.${link.labelKey}`)}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
