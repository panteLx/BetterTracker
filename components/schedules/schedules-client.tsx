"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, Plus } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import {
  amountToInputValue,
  EMPTY_SELECT_VALUE,
  formatCurrency,
  getFrequencyLabel,
  toDateInputValue,
} from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { TrackerPillRow } from "@/components/trackers/tracker-pill-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  locale: string;
  currentUserId: string;
};

function getScheduleStatusLabel(status: Schedule["status"]) {
  if (status === "overdue") return "Überfällig";
  if (status === "due") return "Fällig";
  if (status === "upcoming") return "Demnächst";
  if (status === "completed") return "Abgeschlossen";
  return "Unvollständig";
}

function getStatusVariant(status: Schedule["status"]) {
  if (status === "overdue") return "destructive";
  if (status === "due") return "secondary";
  return "outline";
}

export function SchedulesClient({
  locale,
  currentUserId,
}: SchedulesClientProps) {
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
  const [reactivationDate, setReactivationDate] = useState(
    toDateInputValue(new Date()),
  );

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
    (item) => item.isActive && (item.type === direction || item.type === "transfer"),
  );

  const activePayees = (payeesQuery.data?.items || []).filter((item) => item.isActive);
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
      toast.success("Termin gespeichert");
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
        error instanceof Error ? error.message : "Speichern fehlgeschlagen",
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
      toast.success("Termin aktualisiert");
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
          : "Aktualisierung fehlgeschlagen",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Termin gelöscht");
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Löschen fehlgeschlagen",
      );
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}/create-transaction`, {
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
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}/skip`, {
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

  function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!activeTrackerId) {
      toast.error("Bitte zuerst einen Tracker wählen");
      return;
    }

    if (categoryId === EMPTY_SELECT_VALUE || payeeId === EMPTY_SELECT_VALUE) {
      toast.error("Kategorie und Einzahler sind Pflichtfelder");
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
      toast.error(
        "Name, Betrag, Datum, Kategorie und Einzahler sind Pflichtfelder",
      );
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
      toast.error("Bitte ein neues nächstes Datum angeben");
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

  const currency = tracker?.currency || "EUR";
  const trackers = trackersQuery.data?.items || [];
  const dueCount = dueQuery.data?.items.length ?? 0;
  const upcomingCount = upcomingQuery.data?.items.length ?? 0;
  const inactiveCount = inactiveQuery.data?.items.length ?? 0;

  function renderItems(items: Schedule[]) {
    return (
      <div className="grid gap-3">
        {items.map((item) => {
          const isEditing = editingScheduleId === item.id;
          const isReactivating = reactivatingScheduleId === item.id;
          const isOwnSchedule = item.createdByUserId === currentUserId;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold">{item.name}</h3>
                    <Badge
                      variant={
                        item.direction === "expense"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {item.direction === "expense" ? "Ausgabe" : "Einnahme"}
                    </Badge>
                    <Badge variant={getStatusVariant(item.status)}>
                      {getScheduleStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {item.payeeName || "Einzahler fehlt"} ·{" "}
                      {item.categoryName || "Kategorie fehlt"}
                    </p>
                    <p>
                      Nächster Termin {item.nextDueDate} |{" "}
                      {getFrequencyLabel(item.frequency, item.intervalValue)}
                    </p>
                    {item.lastCompletedDate ? (
                      <p>Zuletzt gebucht am {item.lastCompletedDate}</p>
                    ) : null}
                    {item.lastSkippedDate ? (
                      <p>Zuletzt übersprungen am {item.lastSkippedDate}</p>
                    ) : null}
                    {!item.isComplete ? (
                      <p>
                        Dieser Legacy-Termin braucht noch Einzahler und
                        Kategorie.
                      </p>
                    ) : null}
                    {isOwnSchedule ? (
                      <p className="text-xs">Von dir erstellt</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <div className="mr-1 rounded-full border border-border/60 bg-muted/35 px-3 py-1 font-mono text-base font-semibold tracking-tight tabular-nums">
                    {formatCurrency(item.amountCents, currency, locale)}
                  </div>
                  {item.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => createTransactionMutation.mutate(item.id)}
                      disabled={
                        createTransactionMutation.isPending ||
                        skipScheduleMutation.isPending ||
                        !tracker?.isActive ||
                        !item.canCreateTransaction
                      }
                    >
                      Als Transaktion buchen
                    </Button>
                  ) : null}
                  {item.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => skipScheduleMutation.mutate(item.id)}
                      disabled={
                        createTransactionMutation.isPending ||
                        skipScheduleMutation.isPending ||
                        !isTrackerMutable
                      }
                    >
                      Skip
                    </Button>
                  ) : null}
                  {item.isActive && item.canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => completeSchedule(item.id)}
                      disabled={updateMutation.isPending || !isTrackerMutable}
                    >
                      Abschließen
                    </Button>
                  ) : null}
                  {!item.isActive && item.canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openReactivate(item)}
                      disabled={updateMutation.isPending || !isTrackerMutable}
                    >
                      Reaktivieren
                    </Button>
                  ) : null}
                  {item.canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(item)}
                      disabled={updateMutation.isPending || !isTrackerMutable}
                    >
                      Bearbeiten
                    </Button>
                  ) : null}
                  {item.canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending || !isTrackerMutable}
                    >
                      Löschen
                    </Button>
                  ) : null}
                </div>
              </div>

              {isReactivating ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <DatePicker
                    value={reactivationDate}
                    onChange={setReactivationDate}
                  />
                  <Button
                    type="button"
                    onClick={() => submitReactivate(item.id)}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending
                      ? "Speichert..."
                      : "Jetzt reaktivieren"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setReactivatingScheduleId("")}
                  >
                    Abbrechen
                  </Button>
                </div>
              ) : null}

              {isEditing && editState ? (
                <div className="mt-4 grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input
                        value={editState.name}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, name: event.target.value }
                              : current,
                          )
                        }
                        placeholder="z. B. Miete"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Betrag</Label>
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
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Typ</Label>
                      <Select
                        value={editState.direction}
                        onValueChange={(value) =>
                          setEditState((current) =>
                            current
                              ? {
                                  ...current,
                                  direction: value as "expense" | "income",
                                }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Ausgabe</SelectItem>
                          <SelectItem value="income">Einnahme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Frequenz</Label>
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
                          <SelectItem value="monthly">Monatlich</SelectItem>
                          <SelectItem value="yearly">Jährlich</SelectItem>
                          <SelectItem value="custom_days">Alle X Tage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Intervall</Label>
                      <Input
                        value={editState.intervalValue}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, intervalValue: event.target.value }
                              : current,
                          )
                        }
                        placeholder="1"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EntityPicker
                      kind="category"
                      trackerId={activeTrackerId}
                      locale={locale}
                      label="Kategorie"
                      options={(categoriesQuery.data?.items || [])
                        .filter(
                          (entry) =>
                            entry.type === editState.direction ||
                            entry.type === "transfer",
                        )
                        .map((entry) => ({ value: entry.id, label: entry.name }))}
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
                      label="Einzahler"
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
                  <div className="space-y-1.5">
                    <Label>Nächster Termin</Label>
                    <DatePicker
                      value={editState.nextDueDate}
                      onChange={(value) =>
                        setEditState((current) =>
                          current ? { ...current, nextDueDate: value } : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notizvorlage (optional)</Label>
                    <Input
                      value={editState.notesTemplate}
                      onChange={(event) =>
                        setEditState((current) =>
                          current
                            ? { ...current, notesTemplate: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Wird beim Buchen übernommen"
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cancelEdit}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => submitEdit(item.id)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? "Speichert..." : "Speichern"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-card p-5 text-sm text-muted-foreground">
            Keine Einträge in diesem Tab.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tracker pills + action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TrackerPillRow
          trackers={trackers}
          activeTrackerId={activeTrackerId}
          onSelect={setSelectedTracker}
        />
        <Button
          size="sm"
          onClick={() => setSheetOpen(true)}
          disabled={!isTrackerMutable}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Neuer Termin
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Fällig" value={String(dueCount)} icon={AlertCircle} tone="expense" />
        <StatTile label="Demnächst" value={String(upcomingCount)} icon={Clock} tone="warning" />
        <StatTile
          label="Abgeschlossen"
          value={String(inactiveCount)}
          icon={CheckCircle2}
          tone="neutral"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="due">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="due">
            Fällig
            {dueCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium">
                {dueCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Demnächst
            {upcomingCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium">
                {upcomingCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Abgeschlossen
            {inactiveCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium">
                {inactiveCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="due" className="mt-4">
          {renderItems(dueQuery.data?.items || [])}
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          {renderItems(upcomingQuery.data?.items || [])}
        </TabsContent>
        <TabsContent value="inactive" className="mt-4">
          {renderItems(inactiveQuery.data?.items || [])}
        </TabsContent>
      </Tabs>

      {/* New schedule sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className="flex flex-col gap-0 p-0 sm:max-w-lg">
          {isMobile && (
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
          )}
          <div className="shrink-0 border-b border-border/60 p-5 pr-12">
            <SheetTitle>Neuer Termin</SheetTitle>
            <SheetDescription>für {tracker?.name}</SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={onSubmit} className="space-y-5 p-5">
              {/* Basic data */}
              <div className="space-y-4">
                <p className="text-sm font-semibold">Grunddaten</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="z. B. Miete Juli"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Betrag</Label>
                    <Input
                      id="amount"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="12,50"
                    />
                  </div>
                </div>
                <DirectionToggle size="md" value={direction} onValueChange={setDirection} />
              </div>

              {/* Category */}
              <EntityPicker
                kind="category"
                trackerId={activeTrackerId}
                locale={locale}
                label="Kategorie"
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
                label="Einzahler"
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
                <p className="text-sm font-semibold">Rhythmus</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Frequenz</Label>
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
                        <SelectItem value="monthly">Monatlich</SelectItem>
                        <SelectItem value="yearly">Jährlich</SelectItem>
                        <SelectItem value="custom_days">Alle X Tage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval">Intervall</Label>
                    <Input
                      id="interval"
                      value={intervalValue}
                      onChange={(event) => setIntervalValue(event.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextDueDate">Startdatum</Label>
                    <DatePicker
                      id="nextDueDate"
                      value={nextDueDate}
                      onChange={setNextDueDate}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getFrequencyLabel(frequency, normalizedIntervalValue)}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notesTemplate">Notizvorlage (optional)</Label>
                <Textarea
                  id="notesTemplate"
                  value={notesTemplate}
                  onChange={(event) => setNotesTemplate(event.target.value)}
                  placeholder="Wird beim Buchen übernommen"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || !isTrackerMutable}
              >
                {createMutation.isPending ? "Speichere..." : "Termin anlegen"}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
