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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tracker = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  permission?: "owner" | "admin" | "write" | "read";
};

type Schedule = {
  id: string;
  trackerId: string;
  name: string;
  amountCents: number;
  direction: "expense" | "income";
  frequency: "monthly" | "yearly" | "custom_days";
  intervalValue: number;
  nextDueDate: string;
  isActive: boolean;
  autoCreateDisabled: boolean;
  createdByUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  canCreateTransaction: boolean;
};

type EditScheduleState = {
  name: string;
  amount: string;
  direction: "expense" | "income";
  frequency: "monthly" | "yearly" | "custom_days";
  intervalValue: string;
  nextDueDate: string;
  isActive: boolean;
  autoCreateDisabled: boolean;
};

type SchedulesClientProps = {
  locale: string;
  currentUserId: string;
};

function amountToInputValue(amountCents: number) {
  return (amountCents / 100).toFixed(2).replace(".", ",");
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
  const [frequency, setFrequency] = useState<"monthly" | "yearly" | "custom_days">("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [nextDueDate, setNextDueDate] = useState(toDateInputValue(new Date()));
  const [editingScheduleId, setEditingScheduleId] = useState("");
  const [editState, setEditState] = useState<EditScheduleState | null>(null);

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const activeTrackerId = selectedTracker || trackersQuery.data?.items?.[0]?.id || "";
  const tracker = trackersQuery.data?.items.find((item) => item.id === activeTrackerId);

  const dueQuery = useQuery({
    queryKey: ["schedules", activeTrackerId, "due"],
    queryFn: () =>
      fetchJson<{ items: Schedule[] }>(`/api/schedules?trackerId=${activeTrackerId}&status=due`),
    enabled: Boolean(activeTrackerId),
  });
  const upcomingQuery = useQuery({
    queryKey: ["schedules", activeTrackerId, "upcoming"],
    queryFn: () =>
      fetchJson<{ items: Schedule[] }>(
        `/api/schedules?trackerId=${activeTrackerId}&status=upcoming`
      ),
    enabled: Boolean(activeTrackerId),
  });
  const inactiveQuery = useQuery({
    queryKey: ["schedules", activeTrackerId, "inactive"],
    queryFn: () =>
      fetchJson<{ items: Schedule[] }>(
        `/api/schedules?trackerId=${activeTrackerId}&status=inactive`
      ),
    enabled: Boolean(activeTrackerId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJson("/api/schedules", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Schedule gespeichert");
      setName("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["schedules", activeTrackerId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
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
      toast.success("Schedule aktualisiert");
      setEditingScheduleId("");
      setEditState(null);
      queryClient.invalidateQueries({ queryKey: ["schedules", activeTrackerId] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Schedule geloescht");
      queryClient.invalidateQueries({ queryKey: ["schedules", activeTrackerId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Loeschen fehlgeschlagen");
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/schedules/${id}/create-transaction`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Schedule in Transaktion umgewandelt");
      queryClient.invalidateQueries({ queryKey: ["schedules", activeTrackerId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", activeTrackerId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({
      trackerId: activeTrackerId,
      name,
      amount,
      direction,
      frequency,
      intervalValue: Number(intervalValue),
      nextDueDate,
    });
  }

  function startEdit(item: Schedule) {
    setEditingScheduleId(item.id);
    setEditState({
      name: item.name,
      amount: amountToInputValue(item.amountCents),
      direction: item.direction,
      frequency: item.frequency,
      intervalValue: String(item.intervalValue),
      nextDueDate: item.nextDueDate,
      isActive: item.isActive,
      autoCreateDisabled: item.autoCreateDisabled,
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

    if (!editState.name.trim() || !editState.amount.trim() || !editState.nextDueDate) {
      toast.error("Name, Betrag und naechstes Datum sind Pflichtfelder");
      return;
    }

    updateMutation.mutate({
      id,
      payload: {
        name: editState.name.trim(),
        amount: editState.amount,
        direction: editState.direction,
        frequency: editState.frequency,
        intervalValue: Number(editState.intervalValue),
        nextDueDate: editState.nextDueDate,
        isActive: editState.isActive,
        autoCreateDisabled: editState.autoCreateDisabled,
      },
    });
  }

  const currency = tracker?.currency || "EUR";

  function renderItems(items: Schedule[]) {
    return (
      <div className="grid gap-3">
        {items.map((item) => {
          const isEditing = editingScheduleId === item.id;
          const isOwnSchedule = item.createdByUserId === currentUserId;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-border/60 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.name}</h3>
                    <Badge variant={item.direction === "expense" ? "destructive" : "secondary"}>
                      {item.direction === "expense" ? "Ausgabe" : "Einnahme"}
                    </Badge>
                    {!item.isActive ? <Badge variant="outline">Inaktiv</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.nextDueDate} | {item.frequency} / {item.intervalValue}
                  </p>
                  {isOwnSchedule ? (
                    <p className="text-xs text-muted-foreground">Von dir erstellt</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-lg font-semibold">
                    {formatCurrency(item.amountCents, currency, locale)}
                  </div>
                  {item.isActive ? (
                    <Button
                      size="sm"
                      onClick={() => createTransactionMutation.mutate(item.id)}
                      disabled={
                        createTransactionMutation.isPending ||
                        !tracker?.isActive ||
                        !item.canCreateTransaction
                      }
                    >
                      Als Transaktion uebernehmen
                    </Button>
                  ) : null}
                  {item.canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(item)}
                      disabled={updateMutation.isPending || !tracker?.isActive}
                    >
                      Bearbeiten
                    </Button>
                  ) : null}
                  {item.canDelete ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending || !tracker?.isActive}
                    >
                      Loeschen
                    </Button>
                  ) : null}
                </div>
              </div>

              {isEditing && editState ? (
                <div className="mt-4 grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      value={editState.name}
                      onChange={(event) =>
                        setEditState((current) =>
                          current ? { ...current, name: event.target.value } : current,
                        )
                      }
                      placeholder="Name"
                    />
                    <Input
                      value={editState.amount}
                      onChange={(event) =>
                        setEditState((current) =>
                          current ? { ...current, amount: event.target.value } : current,
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
                            ? { ...current, direction: value as "expense" | "income" }
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
                                frequency: value as "monthly" | "yearly" | "custom_days",
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-center justify-between rounded-2xl border border-border/60 p-3">
                        <div>
                          <p className="text-sm font-medium">Aktiv</p>
                        </div>
                        <Switch
                          checked={editState.isActive}
                          onCheckedChange={(value) =>
                            setEditState((current) =>
                              current ? { ...current, isActive: value } : current,
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-border/60 p-3">
                        <div>
                          <p className="text-sm font-medium">Auto-Create aus</p>
                        </div>
                        <Switch
                          checked={editState.autoCreateDisabled}
                          onCheckedChange={(value) =>
                            setEditState((current) =>
                              current
                                ? { ...current, autoCreateDisabled: value }
                                : current,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={cancelEdit}>
                      Abbrechen
                    </Button>
                    <Button
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
          <p className="text-sm text-muted-foreground">Keine Eintraege in diesem Tab.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Neuer Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tracker</Label>
              <Select value={activeTrackerId} onValueChange={setSelectedTracker}>
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
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Betrag</Label>
                <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select
                  value={direction}
                  onValueChange={(value) => setDirection(value as "expense" | "income")}
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
                  onChange={(e) => setIntervalValue(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextDueDate">Naechstes Datum</Label>
              <Input
                id="nextDueDate"
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={createMutation.isPending || !tracker?.isActive}>
              {createMutation.isPending ? "Speichere..." : "Schedule anlegen"}
            </Button>
            {tracker && !tracker.isActive ? (
              <p className="text-sm text-muted-foreground">
                Dieser Tracker ist archiviert. Schedules koennen nicht bearbeitet werden.
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
              <TabsTrigger value="due">Due</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
            <TabsContent value="due">{renderItems(dueQuery.data?.items || [])}</TabsContent>
            <TabsContent value="upcoming">{renderItems(upcomingQuery.data?.items || [])}</TabsContent>
            <TabsContent value="inactive">{renderItems(inactiveQuery.data?.items || [])}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
