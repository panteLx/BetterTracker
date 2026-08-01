"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";

/**
 * The one action this app exists for, parked in the same spot on every page.
 * Desktop only — on phones the bottom navigation already carries it in the
 * center slot, and two floating buttons would fight over the same corner.
 */
export function QuickAddFab() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Common.quickAdd");

  return (
    <>
      <Button
        shape="pill"
        size="lg"
        className="fixed bottom-6 right-6 z-30 hidden shadow-lg md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {t("fabLabel")}
      </Button>

      <QuickAddSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
