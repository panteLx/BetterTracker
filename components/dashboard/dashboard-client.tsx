"use client";

import Link from "next/link";
import React, { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  Plus,
  ReceiptText,
  Settings2,
  SkipForward,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";
import { TrackerPillRow } from "@/components/trackers/tracker-pill-row";
import {
  TransactionEditForm,
  TransactionRowActions,
  useTransactionEdit,
} from "@/components/transactions/transaction-edit";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DayGroup, ListRow } from "@/components/ui/list-row";
import { SectionCard } from "@/components/ui/section-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatTile } from "@/components/ui/stat-tile";
import { Switch } from "@/components/ui/switch";
import { fetchJson } from "@/lib/client-fetch";
import { rememberTracker } from "@/lib/last-tracker";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";
import { cn, formatDayLabel, groupByDate } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";

type Tracker = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  currency: string;
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  isActive: boolean;
  permission?: "owner" | "admin" | "write" | "read";
  sortOrder?: number;
};

type TransactionItem = {
  id: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryId?: string | null;
  payeeId?: string | null;
  categoryName?: string | null;
  payeeName?: string | null;
  customPayeeName?: string | null;
  notes?: string | null;
  canEdit: boolean;
  canDelete: boolean;
};

type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  isActive: boolean;
};

type Payee = { id: string; name: string; isActive: boolean };

type TransactionResponse = {
  items: TransactionItem[];
  totals: { incomeCents: number; expenseCents: number };
};

type ScheduleForecastItem = {
  scheduleId: string;
  occurrenceKey: string;
  name: string;
  payeeName: string;
  categoryName: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  status: "overdue" | "due" | "upcoming";
};

type ScheduleForecastResponse = {
  days: number;
  baseBalanceCents: number;
  projectedDeltaCents: number;
  projectedBalanceCents: number;
  scheduledIncomeCents: number;
  scheduledExpenseCents: number;
  items: ScheduleForecastItem[];
};

const RECENT_TRANSACTION_LIMIT = 8;

function sortTrackers(items: Tracker[], locale: string) {
  return [...items].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, locale);
  });
}

const scheduleStatusBadge = {
  overdue: { label: "Überfällig", variant: "expense" as const },
  due: { label: "Heute fällig", variant: "warning" as const },
  upcoming: { label: "Demnächst", variant: "outline" as const },
};

type TrackerCreateFormProps = {
  title: string;
  description: string;
  name: string;
  color: string;
  currency: string;
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  isPending: boolean;
  submitLabel: string;
  className?: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onDiscordWebhookUrlChange: (value: string) => void;
  onDiscordPingRoleIdChange: (value: string) => void;
  onDiscordDebugEnabledChange: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
};

function TrackerCreateForm({
  title,
  description,
  name,
  color,
  currency,
  discordWebhookUrl,
  discordDebugEnabled,
  discordPingRoleId,
  isPending,
  submitLabel,
  className,
  onNameChange,
  onColorChange,
  onCurrencyChange,
  onDiscordWebhookUrlChange,
  onDiscordPingRoleIdChange,
  onDiscordDebugEnabledChange,
  onSubmit,
}: TrackerCreateFormProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      {title ? (
        <div className="mb-5 space-y-1">
          <p className="text-lg font-semibold tracking-tight">{title}</p>
          <p className="font-subtext text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-tracker-name">Name</Label>
          <Input
            id="new-tracker-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="z. B. Urlaub"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-tracker-color">Farbe</Label>
          <TrackerColorPicker
            id="new-tracker-color"
            value={color}
            onChange={onColorChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-tracker-currency">Währung</Label>
          <Input
            id="new-tracker-currency"
            value={currency}
            onChange={(event) =>
              onCurrencyChange(event.target.value.toUpperCase())
            }
            placeholder="EUR"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-tracker-webhook">Discord Webhook URL</Label>
          <Input
            id="new-tracker-webhook"
            value={discordWebhookUrl}
            onChange={(event) => onDiscordWebhookUrlChange(event.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-tracker-role">Discord Ping Role ID</Label>
          <Input
            id="new-tracker-role"
            value={discordPingRoleId}
            onChange={(event) => onDiscordPingRoleIdChange(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">Discord Debug</p>
            <p className="font-subtext text-xs text-muted-foreground">
              Zusätzliche Debug-Infos in Discord mitsenden.
            </p>
          </div>
          <Switch
            checked={discordDebugEnabled}
            onCheckedChange={onDiscordDebugEnabledChange}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Speichert…" : submitLabel}
        </Button>
      </form>
    </div>
  );
}

type DashboardClientProps = {
  locale: string;
};

export function DashboardClient({ locale }: DashboardClientProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [newTrackerSheetOpen, setNewTrackerSheetOpen] = useState(false);
  const [newTrackerName, setNewTrackerName] = useState("");
  const [newTrackerColor, setNewTrackerColor] = useState(DEFAULT_TRACKER_COLOR);
  const [newTrackerCurrency, setNewTrackerCurrency] = useState("EUR");
  const [newTrackerDiscordWebhookUrl, setNewTrackerDiscordWebhookUrl] =
    useState("");
  const [newTrackerDiscordPingRoleId, setNewTrackerDiscordPingRoleId] =
    useState("");
  const [newTrackerDiscordDebugEnabled, setNewTrackerDiscordDebugEnabled] =
    useState(false);
  const [draggedTrackerId, setDraggedTrackerId] = useState("");

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const trackers = trackersQuery.data?.items || [];
  const hasTrackers = trackers.length > 0;
  const activeTrackerId = selectedTracker || trackers[0]?.id || "";
  const tracker = trackers.find((item) => item.id === activeTrackerId);
  const currency = tracker?.currency || "EUR";
  const canManageTracker =
    tracker?.permission === "owner" || tracker?.permission === "admin";
  const canCreateContent = tracker?.permission !== "read";

  const transactionsQuery = useQuery({
    queryKey: ["transactions", activeTrackerId],
    queryFn: () =>
      fetchJson<TransactionResponse>(
        `/api/transactions?trackerId=${activeTrackerId}`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Category[] }>(
        `/api/categories?trackerId=${activeTrackerId}`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const payeesQuery = useQuery({
    queryKey: ["payees", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Payee[] }>(`/api/payees?trackerId=${activeTrackerId}`),
    enabled: Boolean(activeTrackerId),
  });

  const trackerEdit = useTransactionEdit(activeTrackerId);
  const isArchived = Boolean(tracker) && !tracker?.isActive;

  const forecastQuery = useQuery({
    queryKey: ["schedules-forecast", activeTrackerId],
    queryFn: () =>
      fetchJson<ScheduleForecastResponse>(
        `/api/schedules/forecast?trackerId=${activeTrackerId}&days=14`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const totals = transactionsQuery.data?.totals ?? {
    incomeCents: 0,
    expenseCents: 0,
  };
  const transactionCount = transactionsQuery.data?.items.length ?? 0;
  const trackerBalance = totals.incomeCents - totals.expenseCents;
  const forecast = forecastQuery.data ?? {
    days: 14,
    baseBalanceCents: trackerBalance,
    projectedDeltaCents: 0,
    projectedBalanceCents: trackerBalance,
    scheduledIncomeCents: 0,
    scheduledExpenseCents: 0,
    items: [],
  };
  const recentGroups = groupByDate(
    (transactionsQuery.data?.items || []).slice(0, RECENT_TRANSACTION_LIMIT),
  );

  const createScheduleTransactionMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      fetchJson(`/api/schedules/${scheduleId}/create-transaction`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Termin gebucht");
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Buchen fehlgeschlagen",
      );
    },
  });

  const skipScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      fetchJson(`/api/schedules/${scheduleId}/skip`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Termin übersprungen");
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Überspringen fehlgeschlagen",
      );
    },
  });

  const createTrackerMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      color: string;
      currency: string;
      discordWebhookUrl: string;
      discordPingRoleId: string;
      discordDebugEnabled: boolean;
    }) =>
      fetchJson<{ item: Tracker }>("/api/trackers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Tracker[] } | undefined>(
        ["trackers"],
        (current) => ({
          items: sortTrackers(
            [
              ...(current?.items || []),
              { ...item, permission: "owner" as const },
            ],
            locale,
          ),
        }),
      );
      toast.success("Tracker angelegt");
      handleTrackerSelect(item.id);
      setNewTrackerSheetOpen(false);
      setNewTrackerName("");
      setNewTrackerColor(DEFAULT_TRACKER_COLOR);
      setNewTrackerCurrency("EUR");
      setNewTrackerDiscordWebhookUrl("");
      setNewTrackerDiscordPingRoleId("");
      setNewTrackerDiscordDebugEnabled(false);
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["payees"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Tracker konnte nicht angelegt werden",
      );
    },
  });

  const reorderTrackersMutation = useMutation({
    mutationFn: (trackerIds: string[]) =>
      fetchJson<{ items: Tracker[] }>("/api/trackers", {
        method: "PATCH",
        body: JSON.stringify({ trackerIds }),
      }),
    onMutate: async (trackerIds) => {
      await queryClient.cancelQueries({ queryKey: ["trackers"] });
      const previous = queryClient.getQueryData<{ items: Tracker[] }>([
        "trackers",
      ]);

      queryClient.setQueryData<{ items: Tracker[] }>(
        ["trackers"],
        (current) => {
          if (!current) return current;

          const trackerMap = new Map(
            current.items.map((item) => [item.id, item]),
          );
          const reorderedItems: Tracker[] = [];

          for (const [index, trackerId] of trackerIds.entries()) {
            const trackerItem = trackerMap.get(trackerId);
            if (!trackerItem) {
              continue;
            }

            reorderedItems.push({ ...trackerItem, sortOrder: index });
          }

          return { items: reorderedItems };
        },
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["trackers"], context.previous);
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Tracker-Reihenfolge konnte nicht gespeichert werden",
      );
    },
    onSuccess: ({ items }) => {
      queryClient.setQueryData(["trackers"], { items });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
  });

  function handleTrackerSelect(nextTrackerId: string) {
    setSelectedTracker(nextTrackerId);
    // Quick-add opens on whichever tracker you last worked in.
    rememberTracker(nextTrackerId);
    trackerEdit.cancelEdit();
  }

  function moveTracker(draggedId: string, targetId: string) {
    if (
      !draggedId ||
      draggedId === targetId ||
      reorderTrackersMutation.isPending
    ) {
      return;
    }

    const currentTrackers = trackersQuery.data?.items || [];
    const draggedIndex = currentTrackers.findIndex(
      (item) => item.id === draggedId,
    );
    const targetIndex = currentTrackers.findIndex(
      (item) => item.id === targetId,
    );

    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextTrackers = [...currentTrackers];
    const [draggedTracker] = nextTrackers.splice(draggedIndex, 1);
    nextTrackers.splice(targetIndex, 0, draggedTracker);

    reorderTrackersMutation.mutate(nextTrackers.map((item) => item.id));
  }

  function handleCreateTracker(event: FormEvent) {
    event.preventDefault();

    if (!newTrackerName.trim()) {
      toast.error("Bitte einen Tracker-Namen eingeben");
      return;
    }

    createTrackerMutation.mutate({
      name: newTrackerName.trim(),
      color: newTrackerColor,
      currency: newTrackerCurrency.trim() || "EUR",
      discordWebhookUrl: newTrackerDiscordWebhookUrl.trim(),
      discordPingRoleId: newTrackerDiscordPingRoleId.trim(),
      discordDebugEnabled: newTrackerDiscordDebugEnabled,
    });
  }

  const schedulesBusy =
    createScheduleTransactionMutation.isPending ||
    skipScheduleMutation.isPending;

  if (!hasTrackers) {
    return (
      <TrackerCreateForm
        title="Ersten Tracker anlegen"
        description="Sobald der erste Tracker steht, kannst du Buchungen, Kategorien und Termine erfassen."
        name={newTrackerName}
        color={newTrackerColor}
        currency={newTrackerCurrency}
        discordWebhookUrl={newTrackerDiscordWebhookUrl}
        discordDebugEnabled={newTrackerDiscordDebugEnabled}
        discordPingRoleId={newTrackerDiscordPingRoleId}
        isPending={createTrackerMutation.isPending}
        submitLabel="Tracker anlegen"
        onNameChange={setNewTrackerName}
        onColorChange={setNewTrackerColor}
        onCurrencyChange={setNewTrackerCurrency}
        onDiscordWebhookUrlChange={setNewTrackerDiscordWebhookUrl}
        onDiscordPingRoleIdChange={setNewTrackerDiscordPingRoleId}
        onDiscordDebugEnabledChange={setNewTrackerDiscordDebugEnabled}
        onSubmit={handleCreateTracker}
        className="max-w-md"
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Tracker selector */}
        <div className="flex flex-wrap items-center gap-2">
          <TrackerPillRow
            trackers={trackers}
            activeTrackerId={activeTrackerId}
            onSelect={handleTrackerSelect}
            draggedTrackerId={draggedTrackerId}
            onDragStart={setDraggedTrackerId}
            onDragEnd={() => setDraggedTrackerId("")}
            onDrop={(targetId) => {
              moveTracker(draggedTrackerId, targetId);
              setDraggedTrackerId("");
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            shape="pill"
            onClick={() => setNewTrackerSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Neuer Tracker
          </Button>
          {tracker && canManageTracker ? (
            <Button
              variant="ghost"
              size="icon-sm"
              shape="pill"
              className="ml-auto"
              asChild
            >
              <Link
                href={`/trackers/${tracker.id}/settings`}
                aria-label={`Einstellungen für ${tracker.name}`}
              >
                <Settings2 className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        {tracker?.description ? (
          <p className="font-subtext text-sm text-muted-foreground">
            {tracker.description}
          </p>
        ) : null}

        {/* The balance is the answer to "how am I doing", so it is the one
            inverted tile on the page. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Saldo"
            tone="inverse"
            icon={Wallet}
            value={
              <Amount
                cents={trackerBalance}
                currency={currency}
                locale={locale}
                size="lg"
                tone="none"
              />
            }
            sublabel={
              forecast.projectedDeltaCents !== 0
                ? `In ${forecast.days} Tagen etwa ${new Intl.NumberFormat(locale, { style: "currency", currency }).format(forecast.projectedBalanceCents / 100)}`
                : undefined
            }
            className="col-span-2 lg:col-span-1"
          />
          <StatTile
            label="Einnahmen"
            icon={ArrowUpRight}
            value={
              <Amount
                cents={totals.incomeCents}
                currency={currency}
                locale={locale}
                size="lg"
                className="text-income"
              />
            }
          />
          <StatTile
            label="Ausgaben"
            icon={ArrowDownLeft}
            value={
              <Amount
                cents={totals.expenseCents}
                currency={currency}
                locale={locale}
                size="lg"
                className="text-expense"
              />
            }
          />
          <StatTile
            label="Buchungen"
            icon={ReceiptText}
            value={transactionCount}
            sublabel={
              forecast.items.length > 0
                ? `${forecast.items.length} geplant in ${forecast.days} Tagen`
                : undefined
            }
            className="col-span-2 lg:col-span-1"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* Recent bookings */}
          <SectionCard
            title="Letzte Buchungen"
            titleRight={
              <Button variant="ghost" size="xs" shape="pill" asChild>
                <Link href="/transactions">Alle ansehen</Link>
              </Button>
            }
          >
            {recentGroups.length > 0 ? (
              <div className="space-y-4">
                {recentGroups.map((group) => (
                  <DayGroup
                    key={group.date}
                    label={formatDayLabel(group.date, locale)}
                    total={
                      <Amount
                        cents={group.items.reduce(
                          (sum, item) =>
                            sum +
                            (item.direction === "expense"
                              ? -item.amountCents
                              : item.amountCents),
                          0,
                        )}
                        currency={currency}
                        locale={locale}
                        size="xs"
                        className="text-muted-foreground"
                      />
                    }
                  >
                    {group.items.map((item) => (
                      <ListRow
                        key={item.id}
                        leading={
                          <EntityIcon
                            icon={
                              item.direction === "expense"
                                ? ArrowDownLeft
                                : ArrowUpRight
                            }
                            size="sm"
                            className={
                              item.direction === "expense"
                                ? "bg-expense-muted text-expense"
                                : "bg-income-muted text-income"
                            }
                          />
                        }
                        title={
                          item.payeeName || item.customPayeeName || "Anonym"
                        }
                        subtitle={item.categoryName || "Ohne Kategorie"}
                        trailing={
                          <Amount
                            cents={item.amountCents}
                            currency={currency}
                            locale={locale}
                            direction={item.direction}
                            signed
                            size="sm"
                          />
                        }
                        actions={
                          <TransactionRowActions
                            item={item}
                            isArchived={isArchived}
                            isSaving={trackerEdit.updateMutation.isPending}
                            isDeleting={trackerEdit.deleteMutation.isPending}
                            locale={locale}
                            onToggleEdit={() => trackerEdit.toggleEdit(item)}
                            onDelete={() =>
                              trackerEdit.deleteMutation.mutate(item.id)
                            }
                          />
                        }
                      >
                        {trackerEdit.editingTransactionId === item.id &&
                        trackerEdit.editState ? (
                          <TransactionEditForm
                            trackerId={activeTrackerId}
                            locale={locale}
                            editState={trackerEdit.editState}
                            onEditStateChange={(updater) =>
                              trackerEdit.setEditState((current) =>
                                current ? updater(current) : current,
                              )
                            }
                            categories={categoriesQuery.data?.items || []}
                            payees={payeesQuery.data?.items || []}
                            onCancel={trackerEdit.cancelEdit}
                            onSubmit={() => trackerEdit.submitEdit(item.id)}
                            isSaving={trackerEdit.updateMutation.isPending}
                          />
                        ) : null}
                      </ListRow>
                    ))}
                  </DayGroup>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="Noch keine Buchungen"
                description="Leg mit dem Plus-Button unten rechts die erste Einnahme oder Ausgabe an."
              />
            )}
          </SectionCard>

          {/* Upcoming scheduled items */}
          <SectionCard
            title={`Nächste ${forecast.days} Tage`}
            titleRight={
              <Button variant="ghost" size="xs" shape="pill" asChild>
                <Link href="/schedules">Termine</Link>
              </Button>
            }
          >
            {forecast.items.length > 0 ? (
              <div className="space-y-1.5">
                {forecast.items.map((item) => {
                  const badge = scheduleStatusBadge[item.status];

                  return (
                    <ListRow
                      key={item.occurrenceKey}
                      leading={
                        <EntityIcon
                          icon={CalendarClock}
                          size="sm"
                          color={tracker?.color}
                        />
                      }
                      meta={
                        <>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <span className="font-subtext text-xs text-muted-foreground">
                            {formatDayLabel(item.date, locale)}
                          </span>
                        </>
                      }
                      title={item.payeeName}
                      subtitle={`${item.categoryName} · ${item.name}`}
                      trailing={
                        <Amount
                          cents={item.amountCents}
                          currency={currency}
                          locale={locale}
                          direction={item.direction}
                          signed
                          size="sm"
                        />
                      }
                      actions={
                        tracker?.isActive && canCreateContent ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              shape="pill"
                              title="Als Buchung übernehmen"
                              aria-label={`${item.name} als Buchung übernehmen`}
                              disabled={schedulesBusy}
                              onClick={() =>
                                createScheduleTransactionMutation.mutate(
                                  item.scheduleId,
                                )
                              }
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              shape="pill"
                              title="Diesen Termin überspringen"
                              aria-label={`${item.name} überspringen`}
                              disabled={schedulesBusy}
                              onClick={() =>
                                skipScheduleMutation.mutate(item.scheduleId)
                              }
                            >
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="Keine Termine in Sicht"
                description={`In den nächsten ${forecast.days} Tagen steht nichts an.`}
              />
            )}
          </SectionCard>
        </div>
      </div>

      {/* New tracker sheet */}
      <Sheet open={newTrackerSheetOpen} onOpenChange={setNewTrackerSheetOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className="flex flex-col gap-0 p-0 sm:max-w-md"
        >
          {isMobile ? (
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted" />
          ) : null}
          <div className="shrink-0 border-b border-border p-5 pr-12">
            <SheetTitle>Neuer Tracker</SheetTitle>
            <SheetDescription>
              Lege einen weiteren Bereich an und verknüpfe auf Wunsch direkt
              Discord.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <TrackerCreateForm
              title=""
              description=""
              name={newTrackerName}
              color={newTrackerColor}
              currency={newTrackerCurrency}
              discordWebhookUrl={newTrackerDiscordWebhookUrl}
              discordDebugEnabled={newTrackerDiscordDebugEnabled}
              discordPingRoleId={newTrackerDiscordPingRoleId}
              isPending={createTrackerMutation.isPending}
              submitLabel="Tracker anlegen"
              className="border-0 bg-transparent p-0 shadow-none"
              onNameChange={setNewTrackerName}
              onColorChange={setNewTrackerColor}
              onCurrencyChange={setNewTrackerCurrency}
              onDiscordWebhookUrlChange={setNewTrackerDiscordWebhookUrl}
              onDiscordPingRoleIdChange={setNewTrackerDiscordPingRoleId}
              onDiscordDebugEnabledChange={setNewTrackerDiscordDebugEnabled}
              onSubmit={handleCreateTracker}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
