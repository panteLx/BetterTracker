"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Landmark, Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { cn, formatCurrency, toDateInputValue } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";

const EMPTY_SELECT_VALUE = "none";

type Tracker = {
  id: string;
  name: string;
  color: string;
  currency: string;
  sortOrder?: number;
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

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, "de"));
}

function sortTrackers(items: Tracker[]) {
  return [...items].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, "de");
  });
}

export function DashboardClient() {
  const queryClient = useQueryClient();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState(EMPTY_SELECT_VALUE);
  const [payeeId, setPayeeId] = useState(EMPTY_SELECT_VALUE);
  const [customPayeeName, setCustomPayeeName] = useState("");
  const [notes, setNotes] = useState("");
  const [showNewPayee, setShowNewPayee] = useState(false);
  const [newPayeeName, setNewPayeeName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTrackerName, setNewTrackerName] = useState("");
  const [newTrackerColor, setNewTrackerColor] = useState("#0f766e");

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const activeTrackerId = selectedTracker || trackersQuery.data?.items?.[0]?.id || "";
  const tracker = trackersQuery.data?.items.find((item) => item.id === activeTrackerId);

  const categoriesQuery = useQuery({
    queryKey: ["categories", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Category[] }>(`/api/categories?trackerId=${activeTrackerId}`),
    enabled: Boolean(activeTrackerId),
  });

  const payeesQuery = useQuery({
    queryKey: ["payees", activeTrackerId],
    queryFn: () => fetchJson<{ items: Payee[] }>(`/api/payees?trackerId=${activeTrackerId}`),
    enabled: Boolean(activeTrackerId),
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", activeTrackerId],
    queryFn: () => fetchJson<TransactionResponse>(`/api/transactions?trackerId=${activeTrackerId}`),
    enabled: Boolean(activeTrackerId),
  });

  const filteredCategories = useMemo(
    () =>
      (categoriesQuery.data?.items || []).filter(
        (item) => item.type === direction || item.type === "transfer"
      ),
    [categoriesQuery.data?.items, direction]
  );

  const totals = transactionsQuery.data?.totals ?? { incomeCents: 0, expenseCents: 0 };
  const transactionCount = transactionsQuery.data?.items.length ?? 0;
  const trackerBalance = totals.incomeCents - totals.expenseCents;
  const latestTransaction = transactionsQuery.data?.items[0];
  const recentTransactions = (transactionsQuery.data?.items || []).slice(0, 6);
  const effectiveCategoryId = filteredCategories.some((item) => item.id === categoryId)
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
      queryClient.invalidateQueries({ queryKey: ["transactions", activeTrackerId] });
      queryClient.invalidateQueries({ queryKey: ["payees", activeTrackerId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
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
          items: sortByName([...(current?.items || []), item]),
        })
      );
      toast.success("Payee angelegt");
      setPayeeId(item.id);
      setCustomPayeeName("");
      setNewPayeeName("");
      setShowNewPayee(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Payee konnte nicht angelegt werden");
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (payload: { trackerId: string; name: string; type: Category["type"] }) =>
      fetchJson<{ item: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Category[] } | undefined>(
        ["categories", activeTrackerId],
        (current) => ({
          items: sortByName([...(current?.items || []), item]),
        })
      );
      toast.success("Kategorie angelegt");
      setCategoryId(item.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Kategorie konnte nicht angelegt werden"
      );
    },
  });

  const createTrackerMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      fetchJson<{ item: Tracker }>("/api/trackers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Tracker[] } | undefined>(["trackers"], (current) => ({
        items: sortTrackers([...(current?.items || []), item]),
      }));
      toast.success("Tracker angelegt");
      setSelectedTracker(item.id);
      setNewTrackerName("");
      setCategoryId(EMPTY_SELECT_VALUE);
      setPayeeId(EMPTY_SELECT_VALUE);
      setCustomPayeeName("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["payees"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Tracker konnte nicht angelegt werden");
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
      toast.error("Bitte zuerst einen Tracker auswaehlen");
      return;
    }

    createTransactionMutation.mutate({
      trackerId: activeTrackerId,
      date,
      amount,
      direction,
      categoryId: effectiveCategoryId === EMPTY_SELECT_VALUE ? null : effectiveCategoryId,
      payeeId: payeeId === EMPTY_SELECT_VALUE ? null : payeeId,
      customPayeeName: customPayeeName.trim() || null,
      notes: notes.trim() || null,
      accountName: "Hauptkonto",
    });
  }

  function handleTrackerSelect(nextTrackerId: string) {
    setSelectedTracker(nextTrackerId);
    resetEntryState();
  }

  function handleCreatePayee() {
    if (!activeTrackerId) {
      toast.error("Bitte zuerst einen Tracker auswaehlen");
      return;
    }

    if (!newPayeeName.trim()) {
      toast.error("Bitte einen Payee-Namen eingeben");
      return;
    }

    createPayeeMutation.mutate({
      trackerId: activeTrackerId,
      name: newPayeeName.trim(),
    });
  }

  function handleCreateCategory() {
    if (!activeTrackerId) {
      toast.error("Bitte zuerst einen Tracker auswaehlen");
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
    });
  }

  const statCards = [
    {
      label: "Einnahmen",
      value: formatCurrency(totals.incomeCents, tracker?.currency || "EUR"),
      icon: ArrowUpRight,
      tone: "text-emerald-600",
      surface: "from-emerald-500/12 via-emerald-500/6 to-transparent",
    },
    {
      label: "Ausgaben",
      value: formatCurrency(totals.expenseCents, tracker?.currency || "EUR"),
      icon: ArrowDownLeft,
      tone: "text-rose-600",
      surface: "from-rose-500/12 via-rose-500/6 to-transparent",
    },
    {
      label: "Saldo",
      value: formatCurrency(trackerBalance, tracker?.currency || "EUR"),
      icon: Landmark,
      tone: trackerBalance >= 0 ? "text-foreground" : "text-rose-600",
      surface: "from-primary/12 via-primary/6 to-transparent",
    },
    {
      label: "Buchungen",
      value: String(transactionCount),
      icon: Tags,
      tone: "text-foreground",
      surface: "from-slate-500/12 via-slate-500/6 to-transparent",
    },
  ];

  return (
    <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/55 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.5)]">
      <CardHeader className="gap-6 border-b border-border/50 bg-gradient-to-r from-primary/8 via-background/60 to-transparent backdrop-blur-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {tracker ? (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {tracker.name}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase">
                  {direction === "expense" ? "Ausgabe" : "Einnahme"}
                </Badge>
              </div>
              <CardTitle className="text-2xl tracking-tight">Buchungen</CardTitle>
              <CardDescription className="max-w-2xl">
                Transaktionen fuer den aktiven Tracker erfassen und die letzten Eintraege direkt
                daneben pruefen.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {(trackersQuery.data?.items || []).map((item) => {
                const isActive = item.id === activeTrackerId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTrackerSelect(item.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-transparent bg-foreground text-background shadow-sm"
                        : "border-border/70 bg-background/75 text-foreground hover:bg-accent"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color || "#0f172a" }}
                    />
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full xl:max-w-sm">
            <div className="rounded-[1.6rem] border border-border/60 bg-background/78 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Tracker
                  </p>
                  <p className="text-lg font-semibold">{tracker?.name || "Kein Tracker aktiv"}</p>
                </div>
                <div
                  className="h-10 w-10 rounded-2xl border border-border/60 shadow-inner"
                  style={{ backgroundColor: tracker?.color || "#0f172a" }}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/55 to-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Letzte Buchung
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {latestTransaction?.payeeName ||
                      latestTransaction?.customPayeeName ||
                      "Noch keine Buchung"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latestTransaction
                      ? `${latestTransaction.date} - ${
                          latestTransaction.direction === "expense" ? "Ausgabe" : "Einnahme"
                        }`
                      : "Neue Eintraege erscheinen sofort hier."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/45 to-background/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Payees
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {payeesQuery.data?.items.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/45 to-background/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Kategorien
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {categoriesQuery.data?.items.length ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/transactions">Alle Transaktionen</Link>
                </Button>
                <Button variant="ghost" asChild className="flex-1">
                  <Link href="/schedules">Schedules</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className={cn(
                  "rounded-[1.35rem] border border-border/60 bg-gradient-to-br p-4 shadow-sm",
                  item.surface
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5">
                    <Icon className={cn("h-4 w-4", item.tone)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 border-t border-transparent px-6 pb-6 pt-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <div className="rounded-[1.8rem] border border-border/60 bg-gradient-to-br from-background/92 via-background/88 to-muted/30 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Neue Buchung</p>
              <p className="text-sm text-muted-foreground">
                Betrag, Kategorie, Payee und Notiz ohne Umwege eintragen.
              </p>
            </div>
            <div className="inline-flex rounded-full border border-border/70 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setDirection("expense")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  direction === "expense"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Ausgabe
              </button>
              <button
                type="button"
                onClick={() => setDirection("income")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  direction === "income"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Einnahme
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entry-date">Datum</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
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
                  required
                />
              </div>
            </div>

            <div className="space-y-3 rounded-[1.4rem] border border-border/60 bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>Kategorie</Label>
                  <p className="text-xs text-muted-foreground">
                    Passende Kategorien fuer den aktuellen Buchungstyp.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewCategory((current) => !current)}
                >
                  <Plus className="h-4 w-4" />
                  Neue Kategorie
                </Button>
              </div>

              <Select
                value={effectiveCategoryId}
                onValueChange={(value) => {
                  setCategoryId(value);
                  if (value !== EMPTY_SELECT_VALUE) {
                    setShowNewCategory(false);
                  }
                }}
              >
                <SelectTrigger className="bg-background/80">
                  <SelectValue placeholder="Kategorie waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Keine Kategorie</SelectItem>
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
                    placeholder={direction === "expense" ? "z. B. Tanken" : "z. B. Gehalt"}
                  />
                  <Button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={createCategoryMutation.isPending}
                  >
                    {createCategoryMutation.isPending ? "Speichert..." : "Anlegen"}
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

            <div className="space-y-3 rounded-[1.4rem] border border-border/60 bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>Payee</Label>
                  <p className="text-xs text-muted-foreground">
                    Vorhandenen Payee waehlen oder direkt neu anlegen.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPayee((current) => !current)}
                >
                  <Plus className="h-4 w-4" />
                  Neuer Payee
                </Button>
              </div>

              <Select
                value={payeeId}
                onValueChange={(value) => {
                  setPayeeId(value);
                  if (value !== EMPTY_SELECT_VALUE) {
                    setCustomPayeeName("");
                    setShowNewPayee(false);
                  }
                }}
              >
                <SelectTrigger className="bg-background/80">
                  <SelectValue placeholder="Payee waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Kein Payee</SelectItem>
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
                    placeholder="z. B. Baeckerei"
                  />
                  <Button
                    type="button"
                    onClick={handleCreatePayee}
                    disabled={createPayeeMutation.isPending}
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
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="custom-payee">Oder einmaliger Freitext</Label>
                  <Input
                    id="custom-payee"
                    value={customPayeeName}
                    onChange={(event) => {
                      setCustomPayeeName(event.target.value);
                      if (event.target.value.trim()) {
                        setPayeeId(EMPTY_SELECT_VALUE);
                      }
                    }}
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
                placeholder="Kurzer Kontext fuer die Buchung"
                rows={4}
              />
            </div>

            <Button
              className="w-full rounded-2xl"
              size="lg"
              disabled={createTransactionMutation.isPending || !activeTrackerId || !date}
            >
              {createTransactionMutation.isPending ? "Speichere..." : "Eintrag speichern"}
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.8rem] border border-border/60 bg-gradient-to-br from-background/92 via-background/88 to-muted/30 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Letzte Transaktionen</p>
                <p className="text-sm text-muted-foreground">
                  Die letzten Eintraege fuer den aktiven Tracker.
                </p>
              </div>
              <div className="rounded-full border border-border/60 bg-background/75 px-3 py-1 text-xs font-medium text-muted-foreground">
                {transactionCount} gesamt
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-[1.4rem] border border-border/60 bg-background/75 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={item.direction === "expense" ? "destructive" : "secondary"}
                        >
                          {item.direction === "expense" ? "Ausgabe" : "Einnahme"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.date}</span>
                      </div>
                      <p className="font-medium">
                        {item.payeeName || item.customPayeeName || "Ohne Payee"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.categoryName || "Ohne Kategorie"}
                        {item.notes ? ` - ${item.notes}` : ""}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold tracking-tight",
                        item.direction === "expense" ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {item.direction === "expense" ? "-" : "+"}
                      {formatCurrency(item.amountCents, tracker?.currency || "EUR")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
                  Noch keine Transaktionen vorhanden.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-border/60 bg-gradient-to-br from-primary/10 via-background/92 to-muted/30 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            <p className="text-sm font-semibold">Neuer Tracker</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Eigene Bereiche wie Haushalt, Urlaub oder Business direkt hier anlegen.
            </p>

            <form onSubmit={handleCreateTracker} className="mt-4 space-y-3">
              <Input
                value={newTrackerName}
                onChange={(event) => setNewTrackerName(event.target.value)}
                placeholder="z. B. Urlaub"
              />
              <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <Input
                  type="color"
                  value={newTrackerColor}
                  onChange={(event) => setNewTrackerColor(event.target.value)}
                  className="h-10 w-full"
                />
                <Button type="submit" disabled={createTrackerMutation.isPending}>
                  {createTrackerMutation.isPending ? "Speichert..." : "Tracker anlegen"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
