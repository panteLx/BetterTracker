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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tracker = { id: string; name: string; currency: string; isActive: boolean };
type Schedule = {
  id: string;
  name: string;
  amountCents: number;
  direction: "expense" | "income";
  frequency: "monthly" | "yearly" | "custom_days";
  intervalValue: number;
  nextDueDate: string;
  isActive: boolean;
};

type SchedulesClientProps = {
  locale: string;
};

export function SchedulesClient({ locale }: SchedulesClientProps) {
  const queryClient = useQueryClient();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [frequency, setFrequency] = useState<"monthly" | "yearly" | "custom_days">("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [nextDueDate, setNextDueDate] = useState(toDateInputValue(new Date()));

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

  const currency = tracker?.currency || "EUR";

  function renderItems(items: Schedule[]) {
    return (
      <div className="grid gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{item.name}</h3>
                <Badge variant={item.direction === "expense" ? "destructive" : "secondary"}>
                  {item.direction === "expense" ? "Ausgabe" : "Einnahme"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {item.nextDueDate} | {item.frequency} / {item.intervalValue}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold">
                {formatCurrency(item.amountCents, currency, locale)}
              </div>
              {item.isActive ? (
                <Button
                  size="sm"
                  onClick={() => createTransactionMutation.mutate(item.id)}
                  disabled={createTransactionMutation.isPending || !tracker?.isActive}
                >
                  Als Transaktion uebernehmen
                </Button>
              ) : null}
            </div>
          </div>
        ))}
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
