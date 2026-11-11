"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";
import { currentWeekRange, shiftWeek, weekdaysOf } from "@/lib/letter-check-week";

type LetterCheckEntry = { date: string; checkedByName: string | null; checkedAt: string };

type DayState = "done" | "missed" | "today" | "future" | "pending";

const STORAGE_EVENT = "bettertracker:letter-checks-toggle";

function readExpanded(key: string) {
  try {
    return window.localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
}

const DOT_STYLES: Record<DayState, string> = {
  done: "bg-emerald-500",
  missed: "bg-destructive",
  today: "bg-primary/40 ring-2 ring-primary/60",
  future: "bg-muted-foreground/25",
  pending: "bg-muted-foreground/25",
};

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
  const storageKey = `bettertracker.letterChecks.expanded.${workspaceId}`;
  const expanded = useSyncExternalStore(
    (listener) => {
      window.addEventListener(STORAGE_EVENT, listener);
      return () => window.removeEventListener(STORAGE_EVENT, listener);
    },
    () => readExpanded(storageKey),
    () => true
  );

  function toggle() {
    const next = !expanded;
    if (!next) setMonday(currentWeekRange().from);
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // Not persisting is harmless.
    }
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  const days = weekdaysOf(monday);
  const todayIso = currentWeekRange().today;
  const isThisWeek = monday === currentWeekRange().from;

  const query = useQuery({
    queryKey: ["letter-checks", workspaceId, monday],
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

  function stateOf(date: string): DayState {
    if (query.isLoading) return "pending";
    if (checked.has(date)) return "done";
    if (date === todayIso) return "today";
    return date > todayIso ? "future" : "missed";
  }

  const doneCount = days.filter((date) => checked.has(date)).length;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const parse = (iso: string) => new Date(`${iso}T00:00:00`);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls="letter-check-body"
          aria-label={expanded ? t("collapse") : t("expand")}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-tight">{t("title")}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{t("progress", { done: doneCount })}</span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                {days.map((date) => (
                  <span key={date} className={cn("h-2 w-2 rounded-full", DOT_STYLES[stateOf(date)])} />
                ))}
              </span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
          />
        </button>
      </div>

      <div
        id="letter-check-body"
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!expanded}>
          <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("prevWeek")}
                  onClick={() => setMonday((current) => shiftWeek(current, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  disabled={isThisWeek}
                  onClick={() => setMonday(currentWeekRange().from)}
                >
                  {t("thisWeek")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("nextWeek")}
                  onClick={() => setMonday((current) => shiftWeek(current, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {days.map((date) => {
                const state = stateOf(date);
                const entry = checked.get(date);
                const disabled = !canEdit || state === "future" || mutation.isPending;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={disabled}
                    aria-pressed={state === "done"}
                    aria-label={t("dayAria", { date: fullDate.format(parse(date)) })}
                    title={entry?.checkedByName ? t("checkedBy", { name: entry.checkedByName }) : undefined}
                    onClick={() => mutation.mutate({ date, value: state !== "done" })}
                    className={cn(
                      "group flex flex-col items-center gap-2 rounded-xl border px-1 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                      state === "done" && "border-emerald-500/30 bg-emerald-500/10",
                      state === "missed" && "border-destructive/40 bg-destructive/5",
                      state === "today" && "border-primary/50 bg-primary/5",
                      (state === "future" || state === "pending") && "border-border opacity-60",
                      !disabled && "hover:bg-muted/60"
                    )}
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {weekday.format(parse(date))}
                    </span>
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors sm:h-10 sm:w-10",
                        state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                        state === "missed" && "border-destructive text-destructive",
                        state === "today" && "border-primary text-primary",
                        (state === "future" || state === "pending") && "border-muted-foreground/30"
                      )}
                    >
                      <Check
                        className={cn(
                          "h-5 w-5 transition-opacity",
                          state === "done" ? "opacity-100" : "opacity-0 group-enabled:group-hover:opacity-40"
                        )}
                        strokeWidth={3}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        state === "missed" ? "font-medium text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {state === "missed"
                        ? t("open")
                        : state === "today"
                          ? t("today")
                          : dayMonth.format(parse(date))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
