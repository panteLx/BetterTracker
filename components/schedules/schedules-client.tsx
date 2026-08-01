"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import {
  amountToInputValue,
  EMPTY_SELECT_VALUE,
  formatDateShort,
  getFrequencyLabel,
  toDateInputValue,
} from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { TrackerPillRow } from "@/components/trackers/tracker-pill-row";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityIcon } from "@/components/ui/entity-icon";
import { ListRow } from "@/components/ui/list-row";
import { Segmented } from "@/components/ui/segmented";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { DirectionToggle } from "@/components/ui/direction-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EntityPicker } from "@/components/transactions/entity-picker";

type Tracker = {
  id: string;
  name: string;
  color?: string;
  currency: string;
  isActive: boolean;
  permission?: "owner" | "admin" | "write" | "read";
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

type Schedule = {
  id: string;
  trackerId: string;
  name: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryId: string | null;
  payeeId: string | null;
  categoryName: string | null;
  payeeName: string | null;
  notesTemplate: string | null;
  frequency: "monthly" | "yearly" | "custom_days";
  intervalValue: number;
  nextDueDate: string;
  lastCompletedDate: string | null;
  lastSkippedDate: string | null;
  isActive: boolean;
  createdByUserId: string;
  status: "overdue" | "due" | "upcoming" | "completed" | "incomplete";
  timingStatus: "overdue" | "due" | "upcoming";
  isComplete: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreateTransaction: boolean;
};

type EditScheduleState = {
  name: string;
  amount: string;
  direction: "expense" | "income";
  categoryId: string;
  payeeId: string;
  notesTemplate: string;
  frequency: "monthly" | "yearly" | "custom_days";
  intervalValue: string;
  nextDueDate: string;
};

type SchedulesClientProps = {
  currentUserId: string;
};

const ALL_FILTER_VALUE = "all";

function getScheduleStatusLabel(
  status: Schedule["status"],
  t: ReturnType<typeof useTranslations>,
) {
  if (status === "overdue") return t("status.overdue");
  if (status === "due") return t("status.due");
  if (status === "upcoming") return t("status.upcoming");
  if (status === "completed") return t("status.completed");
  return t("status.incomplete");
}

function getStatusVariant(status: Schedule["status"]) {
  if (status === "overdue") return "expense" as const;
  if (status === "due") return "warning" as const;
  if (status === "completed") return "income" as const;
  return "outline" as const;
}

export function SchedulesClient({
  currentUserId,
}: SchedulesClientProps) {
  const locale = useLocale();
  const t = useTranslations("Schedules");
  const commonT = useTranslations("Common");
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState(EMPTY_SELECT_VALUE);
  const [payeeId, setPayeeId] = useState(EMPTY_SELECT_VALUE);
  const [notesTemplate, setNotesTemplate] = useState("");
  const [frequency, setFrequency] = useState<
    "monthly" | "yearly" | "custom_days"
  >("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [nextDueDate, setNextDueDate] = useState(toDateInputValue(new Date()));
  const [editingScheduleId, setEditingScheduleId] = useState("");
  const [editState, setEditState] = useState<EditScheduleState | null>(null);
  const [reactivatingScheduleId, setReactivatingScheduleId] = useState("");
  const [tab, setTab] = useState<"due" | "upcoming" | "inactive">("due");
  const [reactivationDate, setReactivationDate] = useState(
    toDateInputValue(new Date()),
  );
  const [filterQuery, setFilterQuery] = useState("");
  const [filterDirection, setFilterDirection] = useState(ALL_FILTER_VALUE);
  const [filterCategoryId, setFilterCategoryId] = useState(ALL_FILTER_VALUE);
  const [filterPayeeId, setFilterPayeeId] = useState(ALL_FILTER_VALUE);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const activeTrackerId =
    selectedTracker || trackersQuery.data?.items?.[0]?.id || "";
  const tracker = trackersQuery.data?.items.find(
    (item) => item.id === activeTrackerId,
  );
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

  const dueQuery = useQuery({
    queryKey: ["schedules", activeTrackerId, "due"],
    queryFn: () =>
      fetchJson<{ items: Schedule[] }>(
        `/api/schedules?trackerId=${activeTrackerId}&status=due`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const upcomingQuery = useQuery({
    queryKey: ["schedules", activeTrackerId, "upcoming"],
    queryFn: () =>
      fetchJson<{ items: Schedule[] }>(
        `/api/schedules?trackerId=${activeTrackerId}&status=upcoming`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const inactiveQuery = useQuery({
    queryKey: ["schedules", activeTrackerId, "inactive"],
    queryFn: () =>
      fetchJson<{ items: Schedule[] }>(
        `/api/schedules?trackerId=${activeTrackerId}&status=inactive`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const filteredCategories = (categoriesQuery.data?.items || []).filter(
    (item) =>
      item.isActive && (item.type === direction || item.type === "transfer"),
  );

  const activePayees = (payeesQuery.data?.items || []).filter(
    (item) => item.isActive,
  );
  const allActiveCategories = (categoriesQuery.data?.items || []).filter(
    (item) => item.isActive,
  );
  const parsedIntervalValue = Number(intervalValue);
  const normalizedIntervalValue =
    Number.isFinite(parsedIntervalValue) && parsedIntervalValue > 0
      ? parsedIntervalValue
      : 1;

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJson("/api/schedules", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success(t("toast.created"));
      setSheetOpen(false);
      setName("");
      setAmount("");
      setCategoryId(EMPTY_SELECT_VALUE);
      setPayeeId(EMPTY_SELECT_VALUE);
      setNotesTemplate("");
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("toast.createError"),
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) =>
      fetchJson(`/api/schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success(t("toast.updated"));
      setEditingScheduleId("");
      setEditState(null);
      setReactivatingScheduleId("");
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("toast.updateError"),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(t("toast.deleted"));
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("toast.deleteError"),
      );
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}/create-transaction`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success(t("toast.booked"));
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
        error instanceof Error ? error.message : t("toast.bookError"),
      );
    },
  });

  const skipScheduleMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}/skip`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success(t("toast.skipped"));
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("toast.skipError"),
      );
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!activeTrackerId) {
      toast.error(t("toast.selectTrackerFirst"));
      return;
    }

    if (categoryId === EMPTY_SELECT_VALUE || payeeId === EMPTY_SELECT_VALUE) {
      toast.error(t("toast.categoryAndPayeeRequired"));
      return;
    }

    createMutation.mutate({
      trackerId: activeTrackerId,
      name,
      amount,
      direction,
      categoryId,
      payeeId,
      notesTemplate: notesTemplate.trim() || null,
      frequency,
      intervalValue: Number(intervalValue),
      nextDueDate,
    });
  }

  function startEdit(item: Schedule) {
    setReactivatingScheduleId("");
    setEditingScheduleId(item.id);
    setEditState({
      name: item.name,
      amount: amountToInputValue(item.amountCents),
      direction: item.direction,
      categoryId: item.categoryId ?? EMPTY_SELECT_VALUE,
      payeeId: item.payeeId ?? EMPTY_SELECT_VALUE,
      notesTemplate: item.notesTemplate ?? "",
      frequency: item.frequency,
      intervalValue: String(item.intervalValue),
      nextDueDate: item.nextDueDate,
    });
  }

  function cancelEdit() {
    setEditingScheduleId("");
    setEditState(null);
  }

  function submitEdit(id: string) {
    if (!editState) {
      return;
    }

    if (
      !editState.name.trim() ||
      !editState.amount.trim() ||
      !editState.nextDueDate ||
      editState.categoryId === EMPTY_SELECT_VALUE ||
      editState.payeeId === EMPTY_SELECT_VALUE
    ) {
      toast.error(t("toast.allFieldsRequired"));
      return;
    }

    updateMutation.mutate({
      id,
      payload: {
        name: editState.name.trim(),
        amount: editState.amount,
        direction: editState.direction,
        categoryId: editState.categoryId,
        payeeId: editState.payeeId,
        notesTemplate: editState.notesTemplate.trim() || null,
        frequency: editState.frequency,
        intervalValue: Number(editState.intervalValue),
        nextDueDate: editState.nextDueDate,
      },
    });
  }

  function completeSchedule(id: string) {
    updateMutation.mutate({
      id,
      payload: {
        isActive: false,
      },
    });
  }

  function openReactivate(item: Schedule) {
    setEditingScheduleId("");
    setEditState(null);
    setReactivatingScheduleId(item.id);
    setReactivationDate(toDateInputValue(new Date()));
  }

  function submitReactivate(id: string) {
    if (!reactivationDate) {
      toast.error(t("toast.reactivationDateRequired"));
      return;
    }

    updateMutation.mutate({
      id,
      payload: {
        isActive: true,
        nextDueDate: reactivationDate,
      },
    });
  }

  function matchesFilters(item: Schedule) {
    if (filterDirection !== ALL_FILTER_VALUE && item.direction !== filterDirection) {
      return false;
    }
    if (filterCategoryId !== ALL_FILTER_VALUE && item.categoryId !== filterCategoryId) {
      return false;
    }
    if (filterPayeeId !== ALL_FILTER_VALUE && item.payeeId !== filterPayeeId) {
      return false;
    }
    if (filterFrom && item.nextDueDate < filterFrom) {
      return false;
    }
    if (filterTo && item.nextDueDate > filterTo) {
      return false;
    }
    if (filterQuery.trim()) {
      const haystack = [item.name, item.payeeName, item.categoryName, item.notesTemplate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(filterQuery.trim().toLowerCase())) {
        return false;
      }
    }
    return true;
  }

  function resetFilters() {
    setFilterQuery("");
    setFilterDirection(ALL_FILTER_VALUE);
    setFilterCategoryId(ALL_FILTER_VALUE);
    setFilterPayeeId(ALL_FILTER_VALUE);
    setFilterFrom("");
    setFilterTo("");
  }

  const activeFilterCount = [
    filterQuery.trim(),
    filterDirection !== ALL_FILTER_VALUE ? filterDirection : "",
    filterCategoryId !== ALL_FILTER_VALUE ? filterCategoryId : "",
    filterPayeeId !== ALL_FILTER_VALUE ? filterPayeeId : "",
    filterFrom,
    filterTo,
  ].filter(Boolean).length;

  const currency = tracker?.currency || "EUR";
  const trackers = trackersQuery.data?.items || [];
  const dueItems = dueQuery.data?.items ?? [];
  const upcomingItems = upcomingQuery.data?.items ?? [];
  const inactiveItems = inactiveQuery.data?.items ?? [];
  const filteredDueItems = dueItems.filter(matchesFilters);
  const filteredUpcomingItems = upcomingItems.filter(matchesFilters);
  const filteredInactiveItems = inactiveItems.filter(matchesFilters);
  const dueCount = dueItems.length;
  const upcomingCount = upcomingItems.length;
  const inactiveCount = inactiveItems.length;

  function renderEditPanel(item: Schedule) {
    if (!editState) return null;

    return (
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("edit.name")}</Label>
            <Input
              value={editState.name}
              onChange={(event) =>
                setEditState((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              placeholder={t("edit.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("edit.amount")}</Label>
            <Input
              value={editState.amount}
              onChange={(event) =>
                setEditState((current) =>
                  current
                    ? { ...current, amount: event.target.value }
                    : current,
                )
              }
              placeholder="12,50"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("edit.type")}</Label>
          <DirectionToggle
            size="sm"
            value={editState.direction}
            onValueChange={(value) =>
              setEditState((current) =>
                current ? { ...current, direction: value } : current,
              )
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <EntityPicker
            kind="category"
            trackerId={activeTrackerId}
            locale={locale}
            label={t("edit.category")}
            options={(categoriesQuery.data?.items || [])
              .filter(
                (entry) =>
                  entry.type === editState.direction ||
                  entry.type === "transfer",
              )
              .map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
            value={editState.categoryId}
            onValueChange={(value) =>
              setEditState((current) =>
                current ? { ...current, categoryId: value } : current,
              )
            }
            required
            direction={editState.direction}
          />
          <EntityPicker
            kind="payee"
            trackerId={activeTrackerId}
            locale={locale}
            label={t("edit.payee")}
            options={(payeesQuery.data?.items || []).map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
            value={editState.payeeId}
            onValueChange={(value) =>
              setEditState((current) =>
                current ? { ...current, payeeId: value } : current,
              )
            }
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("edit.frequency")}</Label>
            <Select
              value={editState.frequency}
              onValueChange={(value) =>
                setEditState((current) =>
                  current
                    ? {
                        ...current,
                        frequency: value as
                          | "monthly"
                          | "yearly"
                          | "custom_days",
                      }
                    : current,
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t("edit.frequencyMonthly")}</SelectItem>
                <SelectItem value="yearly">{t("edit.frequencyYearly")}</SelectItem>
                <SelectItem value="custom_days">{t("edit.frequencyCustomDays")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("edit.interval")}</Label>
            <Input
              value={editState.intervalValue}
              onChange={(event) =>
                setEditState((current) =>
                  current
                    ? {
                        ...current,
                        intervalValue: event.target.value,
                      }
                    : current,
                )
              }
              placeholder="1"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("edit.nextDueDate")}</Label>
            <DatePicker
              value={editState.nextDueDate}
              onChange={(value) =>
                setEditState((current) =>
                  current ? { ...current, nextDueDate: value } : current,
                )
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("edit.notesTemplate")}</Label>
          <Input
            value={editState.notesTemplate}
            onChange={(event) =>
              setEditState((current) =>
                current
                  ? { ...current, notesTemplate: event.target.value }
                  : current,
              )
            }
            placeholder={t("edit.notesTemplatePlaceholder")}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancelEdit}
          >
            {t("edit.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => submitEdit(item.id)}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? t("edit.saving") : t("edit.save")}
          </Button>
        </div>
      </div>
    );
  }

  function renderReactivatePanel(item: Schedule) {
    return (
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <DatePicker value={reactivationDate} onChange={setReactivationDate} />
        <Button
          type="button"
          onClick={() => submitReactivate(item.id)}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? t("reactivate.saving") : t("reactivate.confirm")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setReactivatingScheduleId("")}
        >
          {t("reactivate.cancel")}
        </Button>
      </div>
    );
  }

  /**
   * One row per schedule. Only the action you are most likely to want stays
   * on the surface — booking a due item — with the rarer lifecycle actions
   * behind the overflow menu, so a list of six schedules is not a wall of
   * thirty-six buttons.
   */
  function renderItems(
    items: Schedule[],
    emptyTitle: string,
    emptyText: string,
    unfilteredCount: number,
  ) {
    if (items.length === 0) {
      if (activeFilterCount > 0 && unfilteredCount > 0) {
        return (
          <EmptyState
            icon={CalendarClock}
            title={t("empty.noMatchesTitle")}
            description={t("empty.noMatchesDescription")}
            action={
              <Button
                variant="outline"
                size="sm"
                shape="pill"
                onClick={resetFilters}
              >
                <X className="h-3.5 w-3.5" />
                {t("empty.resetFilters")}
              </Button>
            }
          />
        );
      }
      return (
        <EmptyState
          icon={CalendarClock}
          title={emptyTitle}
          description={emptyText}
        />
      );
    }

    return (
      <div className="space-y-1.5">
        {items.map((item) => {
          const isEditing = editingScheduleId === item.id;
          const isReactivating = reactivatingScheduleId === item.id;
          const isOwnSchedule = item.createdByUserId === currentUserId;
          const busy =
            createTransactionMutation.isPending ||
            skipScheduleMutation.isPending ||
            updateMutation.isPending;

          const overflowItems = [
            item.isActive && {
              key: "skip",
              label: t("actions.skip"),
              icon: SkipForward,
              disabled: busy || !isTrackerMutable,
              onSelect: () => skipScheduleMutation.mutate(item.id),
            },
            item.isActive &&
              item.canEdit && {
                key: "complete",
                label: t("actions.complete"),
                icon: CheckCircle2,
                disabled: busy || !isTrackerMutable,
                onSelect: () => completeSchedule(item.id),
              },
            !item.isActive &&
              item.canEdit && {
                key: "reactivate",
                label: t("actions.reactivate"),
                icon: RotateCcw,
                disabled: busy || !isTrackerMutable,
                onSelect: () => openReactivate(item),
              },
            item.canEdit && {
              key: "edit",
              label: t("actions.edit"),
              icon: Pencil,
              disabled: busy || !isTrackerMutable,
              onSelect: () => (isEditing ? cancelEdit() : startEdit(item)),
            },
            item.canDelete && {
              key: "delete",
              label: t("actions.delete"),
              icon: Trash2,
              destructive: true,
              disabled: deleteMutation.isPending || !isTrackerMutable,
              onSelect: () => deleteMutation.mutate(item.id),
            },
          ].filter(Boolean) as Array<{
            key: string;
            label: string;
            icon: React.ElementType;
            destructive?: boolean;
            disabled: boolean;
            onSelect: () => void;
          }>;

          const subtitleParts = [
            item.payeeName || t("item.payeeMissing"),
            item.categoryName || t("item.categoryMissing"),
            t("item.nextDue", {
              date: formatDateShort(item.nextDueDate, locale),
            }),
            isOwnSchedule ? t("item.byYou") : null,
          ].filter(Boolean);

          return (
            <ListRow
              key={item.id}
              leading={
                <EntityIcon
                  icon={
                    item.direction === "expense" ? ArrowDownLeft : ArrowUpRight
                  }
                  size="sm"
                  className={
                    item.direction === "expense"
                      ? "bg-expense-muted text-expense"
                      : "bg-income-muted text-income"
                  }
                />
              }
              meta={
                <>
                  <Badge variant={getStatusVariant(item.status)}>
                    {getScheduleStatusLabel(item.status, t)}
                  </Badge>
                  <span className="font-subtext text-xs text-muted-foreground">
                    {getFrequencyLabel(item.frequency, item.intervalValue, {
                      monthly: commonT("frequency.monthly"),
                      monthlyInterval: (count) =>
                        commonT("frequency.monthlyInterval", { count }),
                      yearly: commonT("frequency.yearly"),
                      yearlyInterval: (count) =>
                        commonT("frequency.yearlyInterval", { count }),
                      daily: commonT("frequency.daily"),
                      dailyInterval: (count) =>
                        commonT("frequency.dailyInterval", { count }),
                    })}
                  </span>
                  {!item.isComplete ? (
                    <Badge variant="warning">
                      {t("item.incompleteBadge")}
                    </Badge>
                  ) : null}
                </>
              }
              title={item.name}
              subtitle={subtitleParts.join(" · ")}
              trailing={
                <>
                  <Amount
                    cents={item.amountCents}
                    currency={currency}
                    locale={locale}
                    direction={item.direction}
                    signed
                    size="sm"
                  />
                  {item.isActive ? (
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      shape="pill"
                      onClick={() => createTransactionMutation.mutate(item.id)}
                      disabled={
                        busy || !tracker?.isActive || !item.canCreateTransaction
                      }
                    >
                      {t("item.book")}
                    </Button>
                  ) : null}
                </>
              }
              actions={
                overflowItems.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        shape="pill"
                        aria-label={t("item.moreActionsAria", { name: item.name })}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {overflowItems.map((action) => {
                        const Icon = action.icon;
                        return (
                          <DropdownMenuItem
                            key={action.key}
                            disabled={action.disabled}
                            onSelect={action.onSelect}
                            className={
                              action.destructive
                                ? "text-expense focus:text-expense"
                                : undefined
                            }
                          >
                            <Icon className="mr-2 h-4 w-4" />
                            {action.label}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null
              }
            >
              {isReactivating ? renderReactivatePanel(item) : null}
              {isEditing ? renderEditPanel(item) : null}
            </ListRow>
          );
        })}
      </div>
    );
  }

  const tabs = [
    {
      value: "due" as const,
      label: t("tabs.due"),
      count: filteredDueItems.length,
    },
    {
      value: "upcoming" as const,
      label: t("tabs.upcoming"),
      count: filteredUpcomingItems.length,
    },
    {
      value: "inactive" as const,
      label: t("tabs.inactive"),
      count: filteredInactiveItems.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tracker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <TrackerPillRow
          trackers={trackers}
          activeTrackerId={activeTrackerId}
          onSelect={setSelectedTracker}
        />
      </div>

      {/* What needs attention is the point of this page, so it is the
          inverted tile. */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label={t("stats.due")}
          tone="inverse"
          icon={AlertCircle}
          value={dueCount}
        />
        <StatTile label={t("stats.upcoming")} icon={Clock} value={upcomingCount} />
        <StatTile
          label={t("stats.completed")}
          icon={CheckCircle2}
          value={inactiveCount}
        />
      </div>

      {/* Filters stay on screen, mirroring the transactions page: what you
          are looking at is never hidden behind a disclosure you have to
          remember to open. */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("filters.searchPlaceholder")}
              aria-label={t("filters.searchAria")}
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
            />
          </div>

          <Segmented
            label={t("filters.typeLabel")}
            size={isMobile ? "sm" : "md"}
            className="min-w-0 flex-1 sm:flex-none"
            items={[
              { value: ALL_FILTER_VALUE, label: t("filters.typeAll") },
              { value: "expense", label: t("filters.typeExpense") },
              { value: "income", label: t("filters.typeIncome") },
            ]}
            value={filterDirection}
            onValueChange={setFilterDirection}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
            <SelectTrigger
              aria-label={t("filters.categoryAria")}
              className="min-w-36 flex-1 sm:w-44 sm:flex-none"
            >
              <SelectValue placeholder={t("filters.categoryAll")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{t("filters.categoryAll")}</SelectItem>
              {allActiveCategories.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPayeeId} onValueChange={setFilterPayeeId}>
            <SelectTrigger
              aria-label={t("filters.payeeAria")}
              className="min-w-36 flex-1 sm:w-44 sm:flex-none"
            >
              <SelectValue placeholder={t("filters.payeeAll")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{t("filters.payeeAll")}</SelectItem>
              {activePayees.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex min-w-56 flex-1 items-center gap-2 sm:flex-none">
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={filterFrom}
              onChange={setFilterFrom}
              placeholder={t("filters.dateFrom")}
              aria-label={t("filters.dateFromAria")}
            />
            <span className="text-muted-foreground">–</span>
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={filterTo}
              onChange={setFilterTo}
              placeholder={t("filters.dateTo")}
              aria-label={t("filters.dateToAria")}
            />
          </div>

          {activeFilterCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              className="ml-auto"
              onClick={resetFilters}
            >
              <X className="h-3.5 w-3.5" />
              {t("filters.reset", { count: activeFilterCount })}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <Segmented
          label={t("filters.statusLabel")}
          items={tabs.map((entry) => ({
            value: entry.value,
            label: `${entry.label} (${entry.count})`,
          }))}
          value={tab}
          onValueChange={setTab}
        />

        {tab === "due"
          ? renderItems(
              filteredDueItems,
              t("empty.dueTitle"),
              t("empty.dueDescription"),
              dueItems.length,
            )
          : null}
        {tab === "upcoming"
          ? renderItems(
              filteredUpcomingItems,
              t("empty.upcomingTitle"),
              t("empty.upcomingDescription"),
              upcomingItems.length,
            )
          : null}
        {tab === "inactive"
          ? renderItems(
              filteredInactiveItems,
              t("empty.inactiveTitle"),
              t("empty.inactiveDescription"),
              inactiveItems.length,
            )
          : null}
      </div>

      {/* New schedule sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className="flex flex-col gap-0 p-0 sm:max-w-lg"
        >
          {isMobile && (
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
          )}
          <div className="shrink-0 border-b border-border p-5 pr-12">
            <SheetTitle>{t("form.sheetTitle")}</SheetTitle>
            <SheetDescription>
              {t("form.sheetDescriptionFor", { trackerName: tracker?.name ?? "" })}
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={onSubmit} className="space-y-5 p-5">
              {/* Basic data */}
              <div className="space-y-4">
                <p className="text-sm font-semibold">{t("form.basicsHeading")}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("form.name")}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={t("form.namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("form.amount")}</Label>
                    <Input
                      id="amount"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="12,50"
                    />
                  </div>
                </div>
                <DirectionToggle
                  size="md"
                  value={direction}
                  onValueChange={setDirection}
                />
              </div>

              {/* Category */}
              <EntityPicker
                kind="category"
                trackerId={activeTrackerId}
                locale={locale}
                label={t("form.category")}
                options={filteredCategories.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                value={categoryId}
                onValueChange={setCategoryId}
                required
                direction={direction}
                disabled={!isTrackerMutable}
              />

              {/* Payee */}
              <EntityPicker
                kind="payee"
                trackerId={activeTrackerId}
                locale={locale}
                label={t("form.payee")}
                options={activePayees.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                value={payeeId}
                onValueChange={setPayeeId}
                required
                disabled={!isTrackerMutable}
              />

              {/* Frequency */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">{t("form.rhythmHeading")}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-1">
                    <Label>{t("form.frequency")}</Label>
                    <Select
                      value={frequency}
                      onValueChange={(value) =>
                        setFrequency(
                          value as "monthly" | "yearly" | "custom_days",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{t("form.frequencyMonthly")}</SelectItem>
                        <SelectItem value="yearly">{t("form.frequencyYearly")}</SelectItem>
                        <SelectItem value="custom_days">{t("form.frequencyCustomDays")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval">{t("form.interval")}</Label>
                    <Input
                      id="interval"
                      value={intervalValue}
                      onChange={(event) => setIntervalValue(event.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextDueDate">{t("form.startDate")}</Label>
                    <DatePicker
                      id="nextDueDate"
                      value={nextDueDate}
                      onChange={setNextDueDate}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getFrequencyLabel(frequency, normalizedIntervalValue, {
                    monthly: commonT("frequency.monthly"),
                    monthlyInterval: (count) =>
                      commonT("frequency.monthlyInterval", { count }),
                    yearly: commonT("frequency.yearly"),
                    yearlyInterval: (count) =>
                      commonT("frequency.yearlyInterval", { count }),
                    daily: commonT("frequency.daily"),
                    dailyInterval: (count) =>
                      commonT("frequency.dailyInterval", { count }),
                  })}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notesTemplate">{t("form.notesTemplate")}</Label>
                <Textarea
                  id="notesTemplate"
                  value={notesTemplate}
                  onChange={(event) => setNotesTemplate(event.target.value)}
                  placeholder={t("form.notesTemplatePlaceholder")}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || !isTrackerMutable}
              >
                {createMutation.isPending ? t("form.submitting") : t("form.submit")}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
