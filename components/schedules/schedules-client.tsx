"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { formatCurrency, toDateInputValue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (status === "overdue") return "Ueberfaellig";
  if (status === "due") return "Faellig";
  if (status === "upcoming") return "Demnaechst";
  if (status === "completed") return "Abgeschlossen";
  return "Unvollstaendig";
}

function getFrequencyLabel(
  frequency: Schedule["frequency"] | EditScheduleState["frequency"],
  intervalValue: number,
) {
  if (frequency === "monthly") {
    return intervalValue === 1 ? "Monatlich" : `Alle ${intervalValue} Monate`;
  }
  if (frequency === "yearly") {
    return intervalValue === 1 ? "Jaehrlich" : `Alle ${intervalValue} Jahre`;
  }
  return intervalValue === 1 ? "Taeglich" : `Alle ${intervalValue} Tage`;
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
      toast.success("Termin geloescht");
      queryClient.invalidateQueries({
        queryKey: ["schedules", activeTrackerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedules-forecast", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Loeschen fehlgeschlagen",
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
      toast.error("Bitte zuerst einen Tracker waehlen");
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
      toast.error("Bitte zuerst einen Tracker waehlen");
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
      toast.error("Bitte zuerst einen Tracker waehlen");
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
      toast.error("Bitte ein neues naechstes Datum angeben");
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
              className="rounded-2xl border border-border/60 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.name}</h3>
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
                      {item.payeeName || "Einzahler fehlt"} |{" "}
                      {item.categoryName || "Kategorie fehlt"}
                    </p>
                    <p>
                      Naechster Termin {item.nextDueDate} |{" "}
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
                  <div className="mr-2 text-lg font-semibold">
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
                      Abschliessen
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
                      Loeschen
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
                <div className="mt-4 grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
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
                        <SelectItem value="yearly">Jaehrlich</SelectItem>
                        <SelectItem value="custom_days">Custom Days</SelectItem>
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
                        <SelectValue placeholder="Kategorie waehlen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>
                          Bitte waehlen
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
          <p className="text-sm text-muted-foreground">
            Keine Eintraege in diesem Tab.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Neuer Termin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tracker</Label>
              <Select
                value={activeTrackerId}
                onValueChange={setSelectedTracker}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tracker waehlen" />
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
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Betrag</Label>
                <Input
                  id="amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select
                  value={direction}
                  onValueChange={(value) =>
                    setDirection(value as "expense" | "income")
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
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>Kategorie</Label>
                  <p className="text-xs text-muted-foreground">
                    Ein Termin braucht eine feste Kategorie.
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
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>
                    Bitte waehlen
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
                    onChange={(event) => setNewCategoryName(event.target.value)}
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

            <div className="space-y-3 rounded-2xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>Einzahler</Label>
                  <p className="text-xs text-muted-foreground">
                    Ein Termin braucht einen gespeicherten Einzahler.
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
                <SelectTrigger>
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
                    onChange={(event) => setNewPayeeName(event.target.value)}
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
                    {createPayeeMutation.isPending ? "Speichert..." : "Anlegen"}
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

            <div className="space-y-2">
              <Label htmlFor="notesTemplate">Notizvorlage</Label>
              <Input
                id="notesTemplate"
                value={notesTemplate}
                onChange={(event) => setNotesTemplate(event.target.value)}
                placeholder="Wird beim Buchen uebernommen"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Frequenz</Label>
                <Select
                  value={frequency}
                  onValueChange={(value) =>
                    setFrequency(value as "monthly" | "yearly" | "custom_days")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monatlich</SelectItem>
                    <SelectItem value="yearly">Jaehrlich</SelectItem>
                    <SelectItem value="custom_days">Custom Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interval">Intervall</Label>
                <Input
                  id="interval"
                  value={intervalValue}
                  onChange={(event) => setIntervalValue(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextDueDate">Startdatum</Label>
              <Input
                id="nextDueDate"
                type="date"
                value={nextDueDate}
                onChange={(event) => setNextDueDate(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Die erste Faelligkeit wird aus Startdatum plus Intervall
                berechnet.
              </p>
            </div>

            <Button
              className="w-full"
              disabled={createMutation.isPending || !isTrackerMutable}
            >
              {createMutation.isPending ? "Speichere..." : "Termin anlegen"}
            </Button>
            {!canCreateContent ? (
              <p className="text-sm text-muted-foreground">
                Du hast nur Leserechte fuer diesen Tracker.
              </p>
            ) : null}
            {tracker && !tracker.isActive ? (
              <p className="text-sm text-muted-foreground">
                Dieser Tracker ist archiviert. Termine koennen nicht bearbeitet
                werden.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faelligkeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="due">
            <TabsList className="mb-4">
              <TabsTrigger value="due">Faellig</TabsTrigger>
              <TabsTrigger value="upcoming">Demnaechst</TabsTrigger>
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
    </div>
  );
}
