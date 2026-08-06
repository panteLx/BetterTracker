"use client";

import { useTranslations } from "next-intl";
import { ArrowRightCircle, CheckCircle2, Clock, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BulkActionMode =
  | "advance"
  | "medizinControlling"
  | "queuedForPvs"
  | "sentToPvs"
  | "mixed";

type BulkActionBarProps = {
  selectedCount: number;
  mode: BulkActionMode | null;
  isPending: boolean;
  onClear: () => void;
  onAdvance: () => void;
  onQueueForPvs: () => void;
  onSendToPvs: () => void;
  onMarkReturned: () => void;
  onMarkDone: () => void;
};

export function BulkActionBar({
  selectedCount,
  mode,
  isPending,
  onClear,
  onAdvance,
  onQueueForPvs,
  onSendToPvs,
  onMarkReturned,
  onMarkDone,
}: BulkActionBarProps) {
  const t = useTranslations("Cases.board.bulkBar");

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{t("selectedCount", { count: selectedCount })}</span>
        {mode === "mixed" ? (
          <span className="text-xs text-muted-foreground">{t("mixedHint")}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={isPending}>
          <X className="h-4 w-4" />
          {t("clear")}
        </Button>
        {mode === "advance" ? (
          <Button size="sm" onClick={onAdvance} disabled={isPending}>
            <ArrowRightCircle className="h-4 w-4" />
            {isPending ? t("advancing") : t("advanceToMedizinControlling")}
          </Button>
        ) : null}
        {mode === "medizinControlling" ? (
          <>
            <Button variant="outline" size="sm" onClick={onQueueForPvs} disabled={isPending}>
              <Clock className="h-4 w-4" />
              {isPending ? t("queuing") : t("queueForPvs")}
            </Button>
            <Button size="sm" onClick={onSendToPvs} disabled={isPending}>
              <Send className="h-4 w-4" />
              {isPending ? t("sending") : t("sendToPvs")}
            </Button>
          </>
        ) : null}
        {mode === "queuedForPvs" ? (
          <Button size="sm" onClick={onSendToPvs} disabled={isPending}>
            <Send className="h-4 w-4" />
            {isPending ? t("sending") : t("sendToPvs")}
          </Button>
        ) : null}
        {mode === "sentToPvs" ? (
          <>
            <Button variant="outline" size="sm" onClick={onMarkReturned} disabled={isPending}>
              <RotateCcw className="h-4 w-4" />
              {isPending ? t("markingReturned") : t("markReturned")}
            </Button>
            <Button size="sm" onClick={onMarkDone} disabled={isPending}>
              <CheckCircle2 className="h-4 w-4" />
              {isPending ? t("markingDone") : t("markDone")}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
