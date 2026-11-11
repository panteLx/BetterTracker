"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchJson } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";
import { currentWeekRange, shiftWeek, weekdaysOf } from "@/lib/letter-check-week";

type LetterCheckEntry = { date: string; checkedByName: string | null; checkedAt: string };

export function LetterCheckStrip({
  workspaceId,
  canEdit,
}: {
  workspaceId: string;
  canEdit: boolean;
}) {
  const t = useTranslations("Cases.todos.letterChecks");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [monday, setMonday] = useState(() => currentWeekRange().from);

  const days = weekdaysOf(monday);
  const todayIso = currentWeekRange().today;
  const isThisWeek = monday === currentWeekRange().from;
  const key = ["letter-checks", workspaceId, monday];

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      fetchJson<{ items: LetterCheckEntry[] }>(
        `/api/case-workspaces/${workspaceId}/letter-checks?from=${days[0]}&to=${days[4]}`
      ),
  });
  const checked = new Map((query.data?.items ?? []).map((entry) => [entry.date, entry]));

  const mutation = useMutation({
    mutationFn: ({ date, value }: { date: string; value: boolean }) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/letter-checks/${date}`, {
        method: "PUT",
        body: JSON.stringify({ checked: value }),
      }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toastFailed"));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["letter-checks", workspaceId] }),
  });

  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" });
  const fullFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const parse = (iso: string) => new Date(`${iso}T00:00:00`);

  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold leading-tight">{t("title")}</h2>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("prevWeek")}
            onClick={() => setMonday((current) => shiftWeek(current, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isThisWeek}
            onClick={() => setMonday(currentWeekRange().from)}
          >
            {t("thisWeek")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("nextWeek")}
            onClick={() => setMonday((current) => shiftWeek(current, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {days.map((date) => {
          const entry = checked.get(date);
          const isDone = Boolean(entry);
          const isToday = date === todayIso;
          const isFuture = date > todayIso;
          const isMissed = !isDone && !isFuture && !isToday && !query.isLoading;
          return (
            <label
              key={date}
              title={entry?.checkedByName ? t("checkedBy", { name: entry.checkedByName }) : undefined}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-center text-xs transition-colors",
                isDone && "border-emerald-500/40 bg-emerald-500/10",
                isMissed && "border-destructive/60 bg-destructive/10 text-destructive",
                !isDone && !isMissed && "border-border",
                isToday && "ring-2 ring-primary/60",
                isFuture || !canEdit ? "opacity-60" : "cursor-pointer"
              )}
            >
              <span className="font-medium">{dayFormat.format(parse(date))}</span>
              <span className="text-muted-foreground">{dateFormat.format(parse(date))}</span>
              <Checkbox
                checked={isDone}
                disabled={!canEdit || isFuture || mutation.isPending}
                aria-label={t("dayAria", { date: fullFormat.format(parse(date)) })}
                onCheckedChange={(value) => mutation.mutate({ date, value: value === true })}
              />
              {isMissed ? (
                <span className="font-medium">{t("open")}</span>
              ) : isToday ? (
                <span className="text-primary">{t("today")}</span>
              ) : (
                <span className="invisible">–</span>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
