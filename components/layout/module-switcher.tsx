"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid, Wallet, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Entry point between the two top-level parts of the app: the finance
 * trackers and the standalone "Akten" (cases) module. Deliberately not a
 * 5th item in the finance header nav — that nav and the mobile grid are
 * built around exactly 4 finance destinations + a transaction FAB, and the
 * cases module has no equivalent primary action.
 */
type ModuleSwitcherProps = {
  canAccessTrackers?: boolean;
  canAccessCases?: boolean;
};

export function ModuleSwitcher({
  canAccessTrackers = true,
  canAccessCases = true,
}: ModuleSwitcherProps) {
  const pathname = usePathname();
  const t = useTranslations("Nav.moduleSwitcher");
  const inCases = pathname.startsWith("/cases");

  // Nothing to switch to if an admin restricted this user to a single module.
  if (!canAccessTrackers || !canAccessCases) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" shape="pill" aria-label={t("ariaLabel")}>
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" className={cn(!inCases && "bg-accent")}>
            <Wallet className="mr-2 h-4 w-4" />
            {t("finance")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/cases" className={cn(inCases && "bg-accent")}>
            <FileStack className="mr-2 h-4 w-4" />
            {t("cases")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
