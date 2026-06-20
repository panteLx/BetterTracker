"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { formatCurrency, toDateInputValue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_SELECT_VALUE = "none";

type Tracker = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  permission?: "owner" | "admin" | "write" | "read";
};

type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
};

type Payee = {
  id: string;
  name: string;
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

function amountToInputValue(amountCents: number) {
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

function sortByName<T extends { name: string }>(items: T[], locale: string) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, locale),
  );
}

function getScheduleStatusLabel(status: Schedule["status"]) {
  if (status === "overdue") return "Überfällig";
  if (status === "due") return "Fällig";
  if (status === "upcoming") return "Demnächst";
  if (status === "completed") return "Abgeschlossen";
  return "Unvollständig";
}

function getFrequencyLabel(
  frequency: Schedule["frequency"] | EditScheduleState["frequency"],
  intervalValue: number,
) {
  if (frequency === "monthly") {
    return intervalValue === 1 ? "Monatlich" : `Alle ${intervalValue} Monate`;
  }
  if (frequency === "yearly") {
    return intervalValue === 1 ? "Jährlich" : `Alle ${intervalValue} Jahre`;
  }
  return intervalValue === 1 ? "Täglich" : `Alle ${intervalValue} Tage`;
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
  const [selectedTracker, setSelectedTracker] = useState("");
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
  const [showNewPayee, setShowNewPayee] = useState(false);
  const [newPayeeName, setNewPayeeName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
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
    (item) => item.type === direction || item.type === "transfer",
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
      toast.success("Termin gespeichert");
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

  function handleCreatePayee() {
    if (!activeTrackerId) {
      toast.error("Bitte zuerst einen Tracker wählen");
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
      toast.error("Bitte zuerst einen Tracker wählen");
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
              className="rounded-[1.45rem] border border-border/60 bg-background/78 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] backdrop-blur-sm"
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
                  <div className="mr-2 rounded-full border border-border/60 bg-muted/35 px-3 py-1 text-base font-semibold">
                    {formatCurrency(item.amountCents, currency, locale)}
                  </div>
                  {item.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => createTransactionMutation.mutate(item.id)}
                      disabled={
                        createTransactionMutation.isPending ||
                        !tracker?.isActive ||
                        !item.canCreateTransaction
                      }
                    >
                      Als Transaktion buchen
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
                <div className="mt-4 grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    type="date"
                    value={reactivationDate}
                    onChange={(event) =>
                      setReactivationDate(event.target.value)
                    }
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
                <div className="mt-4 grid gap-4 rounded-[1.2rem] border border-border/60 bg-muted/20 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      value={editState.name}
                      onChange={(event) =>
                        setEditState((current) =>
                          current
                            ? { ...current, name: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Name"
                    />
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
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
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
                    <Input
                      value={editState.intervalValue}
                      onChange={(event) =>
                        setEditState((current) =>
                          current
                            ? { ...current, intervalValue: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Intervall"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Select
                      value={editState.categoryId}
                      onValueChange={(value) =>
                        setEditState((current) =>
                          current ? { ...current, categoryId: value } : current,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kategorie wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>
                          Bitte wählen
                        </SelectItem>
                        {(categoriesQuery.data?.items || [])
                          .filter(
                            (entry) =>
                              entry.type === editState.direction ||
                              entry.type === "transfer",
                          )
                          .map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={editState.payeeId}
                      onValueChange={(value) =>
                        setEditState((current) =>
                          current ? { ...current, payeeId: value } : current,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Einzahler wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>
                          Bitte wählen
                        </SelectItem>
                        {(payeesQuery.data?.items || []).map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="date"
                    value={editState.nextDueDate}
                    onChange={(event) =>
                      setEditState((current) =>
                        current
                          ? { ...current, nextDueDate: event.target.value }
                          : current,
                      )
                    }
                  />
                  <Input
                    value={editState.notesTemplate}
                    onChange={(event) =>
                      setEditState((current) =>
                        current
                          ? { ...current, notesTemplate: event.target.value }
                          : current,
                      )
                    }
                    placeholder="Notizvorlage"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      type="button"
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
          <p className="rounded-[1.2rem] border border-dashed border-border/70 bg-background/55 p-5 text-sm text-muted-foreground">
            Keine Einträge in diesem Tab.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/35 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.45)]">
        <CardHeader className="gap-5 border-b border-border/50 bg-gradient-to-r from-primary/8 via-background/80 to-transparent">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl tracking-tight">
                Schedules verwalten
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm">
                Wiederkehrende Buchungen strukturiert anlegen, sauber zuordnen
                und bei Bedarf direkt auslösen.
              </CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.2rem] border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Fällig
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {dueQuery.data?.items.length ?? 0}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Demnächst
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {upcomingQuery.data?.items.length ?? 0}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Abgeschlossen
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {inactiveQuery.data?.items.length ?? 0}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.45rem] border border-primary/15 bg-primary/7 p-4">
              <p className="text-sm font-medium">Neuer Termin</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Erfasse Grunddaten, Zuordnung und Rhythmus in einer kompakten
                Eingabefläche.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <section className="space-y-4 rounded-[1.55rem] border border-border/60 bg-background/78 p-5 shadow-sm">
                <div>
                  <p className="text-sm font-semibold">Grunddaten</p>
                  <p className="text-sm text-muted-foreground">
                    Tracker, Name, Betrag und Richtung des Termins.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
                  <div>
                    <Label>Tracker</Label>
                    <Select
                      value={activeTrackerId}
                      onValueChange={setSelectedTracker}
                    >
                      <SelectTrigger className="mt-2 bg-background/90">
                        <SelectValue placeholder="Tracker wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {(trackersQuery.data?.items || []).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-[1.2rem] border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {direction === "expense" ? "Ausgabe" : "Einnahme"}
                    </p>
                    <p className="mt-1">
                      {amount.trim()
                        ? `${amount} ${tracker?.currency || "EUR"}`
                        : "Betrag noch nicht gesetzt"}
                    </p>
                  </div>
                </div>

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

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setDirection("expense")}
                    className={`rounded-[1.2rem] border px-4 py-3 text-left transition ${
                      direction === "expense"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <p className="font-medium">Ausgabe</p>
                    <p className="mt-1 text-sm">Für Abos, Miete oder Fixkosten.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("income")}
                    className={`rounded-[1.2rem] border px-4 py-3 text-left transition ${
                      direction === "income"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <p className="font-medium">Einnahme</p>
                    <p className="mt-1 text-sm">
                      Für Gehalt, Rückzahlungen oder Gutschriften.
                    </p>
                  </button>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3 rounded-[1.55rem] border border-border/60 bg-background/78 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Kategorie</p>
                      <p className="text-sm text-muted-foreground">
                        Feste Zuordnung für spätere Buchungen.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewCategory((current) => !current)}
                      disabled={!isTrackerMutable}
                    >
                      Neue Kategorie
                    </Button>
                  </div>
                  <Select
                    value={categoryId}
                    onValueChange={setCategoryId}
                    disabled={!isTrackerMutable}
                  >
                    <SelectTrigger className="bg-background/90">
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>
                        Bitte wählen
                      </SelectItem>
                      {filteredCategories.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showNewCategory ? (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <Input
                        value={newCategoryName}
                        onChange={(event) =>
                          setNewCategoryName(event.target.value)
                        }
                        disabled={!isTrackerMutable}
                        placeholder="Neue Kategorie"
                      />
                      <Button
                        type="button"
                        onClick={handleCreateCategory}
                        disabled={
                          createCategoryMutation.isPending || !isTrackerMutable
                        }
                      >
                        {createCategoryMutation.isPending
                          ? "Speichert..."
                          : "Anlegen"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setShowNewCategory(false);
                          setNewCategoryName("");
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-[1.55rem] border border-border/60 bg-background/78 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Einzahler</p>
                      <p className="text-sm text-muted-foreground">
                        Gespeicherter Partner für den Termin.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewPayee((current) => !current)}
                      disabled={!isTrackerMutable}
                    >
                      Neuer Einzahler
                    </Button>
                  </div>
                  <Select
                    value={payeeId}
                    onValueChange={setPayeeId}
                    disabled={!isTrackerMutable}
                  >
                    <SelectTrigger className="bg-background/90">
                      <SelectValue placeholder="Einzahler wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>
                        Bitte wählen
                      </SelectItem>
                      {(payeesQuery.data?.items || []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showNewPayee ? (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <Input
                        value={newPayeeName}
                        onChange={(event) =>
                          setNewPayeeName(event.target.value)
                        }
                        disabled={!isTrackerMutable}
                        placeholder="Neuer Einzahler"
                      />
                      <Button
                        type="button"
                        onClick={handleCreatePayee}
                        disabled={
                          createPayeeMutation.isPending || !isTrackerMutable
                        }
                      >
                        {createPayeeMutation.isPending
                          ? "Speichert..."
                          : "Anlegen"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setShowNewPayee(false);
                          setNewPayeeName("");
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-4 rounded-[1.55rem] border border-border/60 bg-background/78 p-5 shadow-sm">
                <div>
                  <p className="text-sm font-semibold">Rhythmus</p>
                  <p className="text-sm text-muted-foreground">
                    Lege Wiederholung und Start des Termins fest.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px_180px]">
                  <div>
                    <Label>Frequenz</Label>
                    <Select
                      value={frequency}
                      onValueChange={(value) =>
                        setFrequency(
                          value as "monthly" | "yearly" | "custom_days",
                        )
                      }
                    >
                      <SelectTrigger className="mt-2 bg-background/90">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monatlich</SelectItem>
                        <SelectItem value="yearly">Jährlich</SelectItem>
                        <SelectItem value="custom_days">
                          Alle X Tage
                        </SelectItem>
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
                    <Input
                      id="nextDueDate"
                      type="date"
                      value={nextDueDate}
                      onChange={(event) => setNextDueDate(event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="rounded-[1.2rem] border border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
                      Die erste Fälligkeit wird aus Startdatum plus Intervall
                      berechnet.
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-border/60 bg-background/60 p-4 text-sm">
                    <p className="text-muted-foreground">Ergebnis</p>
                    <p className="mt-1 font-medium text-foreground">
                      {getFrequencyLabel(frequency, normalizedIntervalValue)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-[1.55rem] border border-border/60 bg-background/78 p-5 shadow-sm">
                <div>
                  <p className="text-sm font-semibold">Zusatz</p>
                  <p className="text-sm text-muted-foreground">
                    Optionale Notiz, die beim Buchen übernommen wird.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notesTemplate">Notizvorlage</Label>
                  <Textarea
                    id="notesTemplate"
                    value={notesTemplate}
                    onChange={(event) => setNotesTemplate(event.target.value)}
                    placeholder="Wird beim Buchen übernommen"
                    rows={3}
                  />
                </div>
              </section>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  {!canCreateContent ? (
                    <p className="text-sm text-muted-foreground">
                      Du hast nur Leserechte für diesen Tracker.
                    </p>
                  ) : null}
                  {tracker && !tracker.isActive ? (
                    <p className="text-sm text-muted-foreground">
                      Dieser Tracker ist archiviert. Termine können nicht
                      bearbeitet werden.
                    </p>
                  ) : null}
                </div>
                <Button
                  className="min-w-44 rounded-2xl"
                  size="lg"
                  disabled={createMutation.isPending || !isTrackerMutable}
                >
                  {createMutation.isPending ? "Speichere..." : "Termin anlegen"}
                </Button>
              </div>
            </form>
          </div>

          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-muted/25 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle>Fälligkeiten</CardTitle>
              <CardDescription>
                Fällige, kommende und abgeschlossene Termine mit derselben
                Buchungsmechanik wie im Dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <Tabs defaultValue="due">
                <TabsList className="mb-5 grid w-full grid-cols-3 rounded-[1rem] bg-muted/50 p-1">
                  <TabsTrigger value="due">Fällig</TabsTrigger>
                  <TabsTrigger value="upcoming">Demnächst</TabsTrigger>
                  <TabsTrigger value="inactive">Abgeschlossen</TabsTrigger>
                </TabsList>
                <TabsContent value="due">
                  {renderItems(dueQuery.data?.items || [])}
                </TabsContent>
                <TabsContent value="upcoming">
                  {renderItems(upcomingQuery.data?.items || [])}
                </TabsContent>
                <TabsContent value="inactive">
                  {renderItems(inactiveQuery.data?.items || [])}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
