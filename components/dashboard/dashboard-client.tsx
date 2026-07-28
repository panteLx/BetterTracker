"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Settings2,
  Plus,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { fetchJson } from "@/lib/client-fetch";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";
import { cn, formatCurrency, toDateInputValue } from "@/lib/utils";

const EMPTY_SELECT_VALUE = "none";

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

type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  isActive: boolean;
};

type Payee = {
  id: string;
  name: string;
  isActive: boolean;
};

type TransactionItem = {
  id: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryName?: string | null;
  payeeName?: string | null;
  customPayeeName?: string | null;
  notes?: string | null;
};

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

function sortByName<T extends { name: string }>(items: T[], locale: string) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, locale),
  );
}

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

function getScheduleForecastStatusLabel(
  status: ScheduleForecastItem["status"],
) {
  if (status === "overdue") return "Überfällig";
  if (status === "due") return "Fällig";
  return "Demnächst";
}

function getScheduleForecastStatusVariant(
  status: ScheduleForecastItem["status"],
) {
  if (status === "overdue") return "destructive";
  if (status === "due") return "secondary";
  return "outline";
}

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
        "rounded-xl border border-border/60 bg-background/78 p-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {title ? (
        <div className="mb-4 space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
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
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Discord Debug</p>
            <p className="text-xs text-muted-foreground">
              Zusätzliche Debug-Infos in Discord mitsenden.
            </p>
          </div>
          <Switch
            checked={discordDebugEnabled}
            onCheckedChange={onDiscordDebugEnabledChange}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Speichert..." : submitLabel}
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
  const [selectedTracker, setSelectedTracker] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("income");
  const [categoryId, setCategoryId] = useState(EMPTY_SELECT_VALUE);
  const [payeeId, setPayeeId] = useState(EMPTY_SELECT_VALUE);
  const [customPayeeName, setCustomPayeeName] = useState("");
  const [notes, setNotes] = useState("");
  const [showNewPayee, setShowNewPayee] = useState(false);
  const [newPayeeName, setNewPayeeName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
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
  const canManageTracker =
    tracker?.permission === "owner" || tracker?.permission === "admin";
  const canCreateContent = tracker?.permission !== "read";
  const isTrackerMutable = Boolean(tracker?.isActive && canCreateContent);

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

  const transactionsQuery = useQuery({
    queryKey: ["transactions", activeTrackerId],
    queryFn: () =>
      fetchJson<TransactionResponse>(
        `/api/transactions?trackerId=${activeTrackerId}`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const forecastQuery = useQuery({
    queryKey: ["schedules-forecast", activeTrackerId],
    queryFn: () =>
      fetchJson<ScheduleForecastResponse>(
        `/api/schedules/forecast?trackerId=${activeTrackerId}&days=14`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const filteredCategories = useMemo(
    () =>
      (categoriesQuery.data?.items || []).filter(
        (item) =>
          item.isActive &&
          (item.type === direction || item.type === "transfer"),
      ),
    [categoriesQuery.data?.items, direction],
  );

  const activePayees = useMemo(
    () => (payeesQuery.data?.items || []).filter((item) => item.isActive),
    [payeesQuery.data?.items],
  );
  const categoryOptions = useMemo(
    () => [
      { value: EMPTY_SELECT_VALUE, label: "Bitte wählen" },
      ...filteredCategories.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    ],
    [filteredCategories],
  );
  const payeeOptions = useMemo(
    () => [
      { value: EMPTY_SELECT_VALUE, label: "Anonym" },
      ...activePayees.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    ],
    [activePayees],
  );

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
  const recentTransactions = (transactionsQuery.data?.items || []).slice(0, 6);
  const upcomingScheduledItems = forecast.items;

  // Used only for form submission validation — checks that the selected category
  // matches the current direction (expense/income) to block cross-type submissions.
  const effectiveCategoryId = filteredCategories.some(
    (item) => item.id === categoryId,
  )
    ? categoryId
    : EMPTY_SELECT_VALUE;

  const createTransactionMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJson("/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Transaktion gespeichert");
      setAmount("");
      setNotes("");
      setCustomPayeeName("");
      setSheetOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["transactions", activeTrackerId],
      });
      queryClient.invalidateQueries({ queryKey: ["payees", activeTrackerId] });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Speichern fehlgeschlagen",
      );
    },
  });

  const createScheduleTransactionMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      fetchJson(`/api/schedules/${scheduleId}/create-transaction`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Termin als Transaktion gebucht");
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
        error instanceof Error ? error.message : "Aktion fehlgeschlagen",
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

  const createPayeeMutation = useMutation({
    mutationFn: (payload: { trackerId: string; name: string }) =>
      fetchJson<{ item: Payee }>("/api/payees", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Payee[] } | undefined>(
        ["payees", activeTrackerId],
        (current) => ({
          items: sortByName([...(current?.items || []), item], locale),
        }),
      );
      toast.success("Einzahler angelegt");
      setPayeeId(item.id);
      setCustomPayeeName("");
      setNewPayeeName("");
      setShowNewPayee(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Einzahler konnte nicht angelegt werden",
      );
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (payload: {
      trackerId: string;
      name: string;
      type: Category["type"];
    }) =>
      fetchJson<{ item: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Category[] } | undefined>(
        ["categories", activeTrackerId],
        (current) => ({
          items: sortByName([...(current?.items || []), item], locale),
        }),
      );
      toast.success("Kategorie angelegt");
      setCategoryId(item.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kategorie konnte nicht angelegt werden",
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
      setSelectedTracker(item.id);
      setNewTrackerSheetOpen(false);
      setNewTrackerName("");
      setNewTrackerColor(DEFAULT_TRACKER_COLOR);
      setNewTrackerCurrency("EUR");
      setNewTrackerDiscordWebhookUrl("");
      setNewTrackerDiscordPingRoleId("");
      setNewTrackerDiscordDebugEnabled(false);
      setCategoryId(EMPTY_SELECT_VALUE);
      setPayeeId(EMPTY_SELECT_VALUE);
      setCustomPayeeName("");
      setNotes("");
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

      queryClient.setQueryData<{ items: Tracker[] }>(["trackers"], (current) => {
        if (!current) return current;

        const trackerMap = new Map(current.items.map((item) => [item.id, item]));
        const reorderedItems: Tracker[] = [];

        for (const [index, trackerId] of trackerIds.entries()) {
          const trackerItem = trackerMap.get(trackerId);
          if (!trackerItem) {
            continue;
          }

          reorderedItems.push({ ...trackerItem, sortOrder: index });
        }

        return { items: reorderedItems };
      });

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

  function resetEntryState() {
    setCategoryId(EMPTY_SELECT_VALUE);
    setPayeeId(EMPTY_SELECT_VALUE);
    setCustomPayeeName("");
    setNotes("");
    setShowNewPayee(false);
    setShowNewCategory(false);
    setNewPayeeName("");
    setNewCategoryName("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!activeTrackerId) {
      toast.error("Bitte zuerst einen Tracker anlegen");
      return;
    }

    if (effectiveCategoryId === EMPTY_SELECT_VALUE) {
      toast.error("Bitte eine Kategorie wählen");
      return;
    }

    createTransactionMutation.mutate({
      trackerId: activeTrackerId,
      date,
      amount,
      direction,
      categoryId: effectiveCategoryId,
      payeeId: payeeId === EMPTY_SELECT_VALUE ? null : payeeId,
      customPayeeName: customPayeeName.trim() || null,
      notes: notes.trim() || null,
    });
  }

  function handleTrackerSelect(nextTrackerId: string) {
    setSelectedTracker(nextTrackerId);
    resetEntryState();
  }

  function moveTracker(draggedId: string, targetId: string) {
    if (!draggedId || draggedId === targetId || reorderTrackersMutation.isPending) {
      return;
    }

    const currentTrackers = trackersQuery.data?.items || [];
    const draggedIndex = currentTrackers.findIndex((item) => item.id === draggedId);
    const targetIndex = currentTrackers.findIndex((item) => item.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextTrackers = [...currentTrackers];
    const [draggedTracker] = nextTrackers.splice(draggedIndex, 1);
    nextTrackers.splice(targetIndex, 0, draggedTracker);

    reorderTrackersMutation.mutate(nextTrackers.map((item) => item.id));
  }

  function handleCreatePayee() {
    if (!activeTrackerId) {
      toast.error("Bitte zuerst einen Tracker anlegen");
      return;
    }

    if (!newPayeeName.trim()) {
      toast.error("Bitte einen Einzahler-Namen eingeben");
      return;
    }

    createPayeeMutation.mutate({
      trackerId: activeTrackerId,
      name: newPayeeName.trim(),
    });
  }

  function handleCreateCategory() {
    if (!activeTrackerId) {
      toast.error("Bitte zuerst einen Tracker anlegen");
      return;
    }

    if (!newCategoryName.trim()) {
      toast.error("Bitte einen Kategorienamen eingeben");
      return;
    }

    createCategoryMutation.mutate({
      trackerId: activeTrackerId,
      name: newCategoryName.trim(),
      type: direction,
    });
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

  const statCards = [
    {
      label: "Einnahmen",
      value: formatCurrency(
        totals.incomeCents,
        tracker?.currency || "EUR",
        locale,
      ),
      icon: ArrowUpRight,
      tone: "text-income",
      surface: "from-income-muted/60 via-income-muted/20 to-transparent",
    },
    {
      label: "Ausgaben",
      value: formatCurrency(
        totals.expenseCents,
        tracker?.currency || "EUR",
        locale,
      ),
      icon: ArrowDownLeft,
      tone: "text-expense",
      surface: "from-expense-muted/60 via-expense-muted/20 to-transparent",
    },
    {
      label: "Saldo",
      value: formatCurrency(trackerBalance, tracker?.currency || "EUR", locale),
      secondaryValue: hasTrackers
        ? `Prognose in ${forecast.days} Tagen: ${formatCurrency(
            forecast.projectedBalanceCents,
            tracker?.currency || "EUR",
            locale,
          )}`
        : undefined,
      helperText: hasTrackers
        ? `Geplant: +${formatCurrency(
            forecast.scheduledIncomeCents,
            tracker?.currency || "EUR",
            locale,
          )} / -${formatCurrency(
            forecast.scheduledExpenseCents,
            tracker?.currency || "EUR",
            locale,
          )}`
        : undefined,
      icon: Landmark,
      tone: trackerBalance >= 0 ? "text-foreground" : "text-expense",
      surface: "from-primary/10 via-primary/5 to-transparent",
    },
    {
      label: "Buchungen",
      value: String(transactionCount),
      icon: Tags,
      tone: "text-foreground",
      surface: "from-muted/60 via-muted/20 to-transparent",
    },
  ];

  if (trackersQuery.isPending) {
    return null;
  }

  return (
    <>
      {!hasTrackers ? (
        <TrackerCreateForm
          title="Ersten Tracker anlegen"
          description="Sobald der erste Tracker erstellt ist, kannst du sofort Buchungen, Kategorien und Termine erfassen."
          name={newTrackerName}
          color={newTrackerColor}
          currency={newTrackerCurrency}
          discordWebhookUrl={newTrackerDiscordWebhookUrl}
          discordDebugEnabled={newTrackerDiscordDebugEnabled}
          discordPingRoleId={newTrackerDiscordPingRoleId}
          isPending={createTrackerMutation.isPending}
          submitLabel="Jetzt starten"
          onNameChange={setNewTrackerName}
          onColorChange={setNewTrackerColor}
          onCurrencyChange={setNewTrackerCurrency}
          onDiscordWebhookUrlChange={setNewTrackerDiscordWebhookUrl}
          onDiscordPingRoleIdChange={setNewTrackerDiscordPingRoleId}
          onDiscordDebugEnabledChange={setNewTrackerDiscordDebugEnabled}
          onSubmit={handleCreateTracker}
          className="max-w-md"
        />
      ) : (
        <div className="space-y-4">
          {/* Tracker selector + actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {trackers.map((item) => {
                const isActive = item.id === activeTrackerId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    aria-label={`Tracker ${item.name} auswählen`}
                    aria-pressed={isActive}
                    onClick={() => handleTrackerSelect(item.id)}
                    onDragStart={() => setDraggedTrackerId(item.id)}
                    onDragEnd={() => setDraggedTrackerId("")}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      moveTracker(draggedTrackerId, item.id);
                      setDraggedTrackerId("");
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      isActive
                        ? "border-transparent bg-foreground text-background shadow-sm"
                        : "border-border/70 bg-background/75 text-foreground hover:bg-accent",
                      draggedTrackerId === item.id && "opacity-60",
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color || "#0f766e" }}
                    />
                    {item.name}
                    {!item.isActive ? " (Archiv)" : ""}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setNewTrackerSheetOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Neuer Tracker</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {tracker && canManageTracker ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  asChild
                >
                  <Link href={`/trackers/${tracker.id}/settings`}>
                    <Settings2 className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={() => setSheetOpen(true)}
                disabled={!isTrackerMutable}
              >
                <Plus className="h-4 w-4" />
                Neue Buchung
              </Button>
            </div>
          </div>

          {tracker?.description ? (
            <p className="text-sm text-muted-foreground">
              {tracker.description}
            </p>
          ) : null}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {statCards.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-xl border border-border/60 bg-gradient-to-br p-3",
                    item.surface,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {item.label}
                      </p>
                      <p
                        className={cn(
                          "text-xl font-semibold tracking-tight",
                          item.tone,
                        )}
                      >
                        {item.value}
                      </p>
                      {"secondaryValue" in item && item.secondaryValue ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          {item.secondaryValue}
                        </p>
                      ) : null}
                      {"helperText" in item && item.helperText ? (
                        <p className="text-xs text-muted-foreground">
                          {item.helperText}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-lg border border-border/60 bg-background/80 p-2">
                      <Icon className={cn("h-3.5 w-3.5", item.tone)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main 2-col layout */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Upcoming schedules */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Nächste Termine</p>
                  <p className="text-xs text-muted-foreground">
                    Fälligkeiten der nächsten {forecast.days} Tage.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border/60 bg-background/75 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {forecast.items.length} geplant
                </span>
              </div>
              <div className="space-y-2">
                {upcomingScheduledItems.length > 0 ? (
                  upcomingScheduledItems.map((item) => (
                    <div
                      key={item.occurrenceKey}
                      className="rounded-xl border border-border/60 bg-background/80 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={getScheduleForecastStatusVariant(
                                item.status,
                              )}
                              className="text-xs"
                            >
                              {getScheduleForecastStatusLabel(item.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {item.date}
                            </span>
                          </div>
                          <p className="truncate text-sm font-medium">
                            {item.payeeName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.categoryName} · {item.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              item.direction === "expense"
                                ? "text-expense"
                                : "text-income",
                            )}
                          >
                            {item.direction === "expense" ? "-" : "+"}
                            {formatCurrency(
                              item.amountCents,
                              tracker?.currency || "EUR",
                              locale,
                            )}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-1.5 h-7 text-xs"
                            onClick={() =>
                              createScheduleTransactionMutation.mutate(
                                item.scheduleId,
                              )
                            }
                            disabled={
                              createScheduleTransactionMutation.isPending ||
                              skipScheduleMutation.isPending ||
                              !tracker?.isActive
                            }
                          >
                            Buchen
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-1.5 h-7 text-xs"
                            onClick={() =>
                              skipScheduleMutation.mutate(item.scheduleId)
                            }
                            disabled={
                              createScheduleTransactionMutation.isPending ||
                              skipScheduleMutation.isPending ||
                              !tracker?.isActive
                            }
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                    Keine Termine in den nächsten {forecast.days} Tagen.
                  </div>
                )}
              </div>
            </div>

            {/* Recent transactions */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Letzte Transaktionen</p>
                  <p className="text-xs text-muted-foreground">
                    Aktuelle Einträge im Überblick.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border/60 bg-background/75 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {transactionCount} gesamt
                </span>
              </div>
              <div className="space-y-2">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              item.direction === "expense"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {item.direction === "expense"
                              ? "Ausgabe"
                              : "Einnahme"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.date}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium">
                          {item.payeeName || item.customPayeeName || "Anonym"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.categoryName || "Ohne Kategorie"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-semibold",
                          item.direction === "expense"
                            ? "text-rose-600"
                            : "text-emerald-600",
                        )}
                      >
                        {item.direction === "expense" ? "-" : "+"}
                        {formatCurrency(
                          item.amountCents,
                          tracker?.currency || "EUR",
                          locale,
                        )}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                    Noch keine Transaktionen vorhanden.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New tracker sheet */}
      <Sheet open={newTrackerSheetOpen} onOpenChange={setNewTrackerSheetOpen}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 sm:max-w-md"
        >
          <div className="shrink-0 border-b border-border/60 p-5 pr-12">
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

      {/* Booking sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 sm:max-w-md"
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-border/60 p-5 pr-12">
            <div className="flex-1 min-w-0 space-y-1">
              <SheetTitle>Neue Buchung</SheetTitle>
              <SheetDescription>für {tracker?.name}</SheetDescription>
            </div>
            <div className="shrink-0 inline-flex rounded-full border border-border/70 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setDirection("expense");
                  setCategoryId(EMPTY_SELECT_VALUE);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  direction === "expense"
                    ? "bg-expense text-expense-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Ausgabe
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection("income");
                  setCategoryId(EMPTY_SELECT_VALUE);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  direction === "income"
                    ? "bg-income text-income-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Einnahme
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="entry-date">Datum</Label>
                  <DatePicker
                    id="entry-date"
                    value={date}
                    onChange={setDate}
                    disabled={!isTrackerMutable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-amount">Betrag</Label>
                  <Input
                    id="entry-amount"
                    inputMode="decimal"
                    placeholder="12,50"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    disabled={!isTrackerMutable}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Kategorie</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setShowNewCategory((current) => !current)}
                    disabled={!isTrackerMutable}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Neu
                  </Button>
                </div>
                <SearchableSelect
                  value={categoryId}
                  onValueChange={(value) => {
                    setCategoryId(value);
                    if (value !== EMPTY_SELECT_VALUE) {
                      setShowNewCategory(false);
                    }
                  }}
                  items={categoryOptions}
                  placeholder="Kategorie wählen"
                  searchPlaceholder="Kategorie suchen"
                  emptyMessage="Keine Kategorie gefunden."
                  disabled={!isTrackerMutable}
                />
                {showNewCategory ? (
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={newCategoryName}
                      onChange={(event) =>
                        setNewCategoryName(event.target.value)
                      }
                      disabled={!isTrackerMutable}
                      placeholder={
                        direction === "expense"
                          ? "z. B. Tanken"
                          : "z. B. Gehalt"
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={
                        createCategoryMutation.isPending || !isTrackerMutable
                      }
                    >
                      {createCategoryMutation.isPending ? "..." : "Anlegen"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName("");
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Einzahler</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setShowNewPayee((current) => !current)}
                    disabled={!isTrackerMutable}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Neu
                  </Button>
                </div>
                <SearchableSelect
                  value={payeeId}
                  onValueChange={(value) => {
                    setPayeeId(value);
                    if (value !== EMPTY_SELECT_VALUE) {
                      setCustomPayeeName("");
                      setShowNewPayee(false);
                    }
                  }}
                  items={payeeOptions}
                  placeholder="Einzahler wählen"
                  searchPlaceholder="Einzahler suchen"
                  emptyMessage="Kein Einzahler gefunden."
                  disabled={!isTrackerMutable}
                />
                {showNewPayee ? (
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={newPayeeName}
                      onChange={(event) => setNewPayeeName(event.target.value)}
                      disabled={!isTrackerMutable}
                      placeholder="z. B. Bäckerei"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreatePayee}
                      disabled={
                        createPayeeMutation.isPending || !isTrackerMutable
                      }
                    >
                      {createPayeeMutation.isPending ? "..." : "Anlegen"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      onClick={() => {
                        setShowNewPayee(false);
                        setNewPayeeName("");
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="custom-payee"
                      className="text-xs text-muted-foreground"
                    >
                      Oder einmaliger Freitext
                    </Label>
                    <Input
                      id="custom-payee"
                      value={customPayeeName}
                      onChange={(event) => {
                        setCustomPayeeName(event.target.value);
                        if (event.target.value.trim()) {
                          setPayeeId(EMPTY_SELECT_VALUE);
                        }
                      }}
                      disabled={!isTrackerMutable}
                      placeholder="z. B. Wochenmarkt"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry-notes">Notizen</Label>
                <Textarea
                  id="entry-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={!isTrackerMutable}
                  placeholder="Kurzer Kontext für die Buchung"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={
                  createTransactionMutation.isPending ||
                  !activeTrackerId ||
                  !date ||
                  !isTrackerMutable ||
                  effectiveCategoryId === EMPTY_SELECT_VALUE
                }
              >
                {createTransactionMutation.isPending
                  ? "Speichere..."
                  : "Eintrag speichern"}
              </Button>

              {!canCreateContent ? (
                <p className="text-xs text-muted-foreground">
                  Du hast nur Leserechte für diesen Tracker.
                </p>
              ) : null}
              {tracker && !tracker.isActive ? (
                <p className="text-xs text-muted-foreground">
                  Dieser Tracker ist archiviert.
                </p>
              ) : null}
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
