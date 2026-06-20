"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALL_FILTER_VALUE = "all";
const EMPTY_SELECT_VALUE = "none";

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
};

type Payee = { id: string; name: string };

type Transaction = {
  id: string;
  trackerId: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryId?: string | null;
  payeeId?: string | null;
  categoryName?: string | null;
  payeeName?: string | null;
  customPayeeName?: string | null;
  notes?: string | null;
  source: "manual" | "schedule";
  createdByUserId: string;
  canEdit: boolean;
  canDelete: boolean;
};

type TransactionsClientProps = {
  locale: string;
  currentUserId: string;
};

type EditTransactionState = {
  date: string;
  amount: string;
  direction: "expense" | "income";
  categoryId: string;
  payeeId: string;
  customPayeeName: string;
  notes: string;
};

function amountToInputValue(amountCents: number) {
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

export function TransactionsClient({
  locale,
  currentUserId,
}: TransactionsClientProps) {
  const queryClient = useQueryClient();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState(ALL_FILTER_VALUE);
  const [categoryId, setCategoryId] = useState(ALL_FILTER_VALUE);
  const [payeeId, setPayeeId] = useState(ALL_FILTER_VALUE);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [editState, setEditState] = useState<EditTransactionState | null>(null);

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const activeTrackerId =
    selectedTracker || trackersQuery.data?.items?.[0]?.id || "";
  const tracker = trackersQuery.data?.items.find(
    (item) => item.id === activeTrackerId,
  );

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
    queryKey: [
      "transactions",
      activeTrackerId,
      query,
      direction,
      categoryId,
      payeeId,
      from,
      to,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ trackerId: activeTrackerId });

      if (query.trim()) params.set("q", query.trim());
      if (direction !== ALL_FILTER_VALUE) params.set("direction", direction);
      if (categoryId !== ALL_FILTER_VALUE) params.set("categoryId", categoryId);
      if (payeeId !== ALL_FILTER_VALUE) params.set("payeeId", payeeId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      return fetchJson<{
        items: Transaction[];
        totals: { incomeCents: number; expenseCents: number };
      }>(`/api/transactions?${params.toString()}`);
    },
    enabled: Boolean(activeTrackerId),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) =>
      fetchJson(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Transaktion aktualisiert");
      setEditingTransactionId("");
      setEditState(null);
      queryClient.invalidateQueries({
        queryKey: ["transactions", activeTrackerId],
      });
      queryClient.invalidateQueries({ queryKey: ["payees", activeTrackerId] });
      queryClient.invalidateQueries({
        queryKey: ["categories", activeTrackerId],
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
      fetchJson(`/api/transactions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Transaktion gelöscht");
      queryClient.invalidateQueries({
        queryKey: ["transactions", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Löschen fehlgeschlagen",
      );
    },
  });

  const currency = tracker?.currency || "EUR";
  const totals = transactionsQuery.data?.totals ?? {
    incomeCents: 0,
    expenseCents: 0,
  };
  const balance = totals.incomeCents - totals.expenseCents;

  const editCategories = useMemo(() => {
    if (!editState) return [];
    return (categoriesQuery.data?.items || []).filter(
      (item) => item.type === editState.direction || item.type === "transfer",
    );
  }, [categoriesQuery.data?.items, editState]);

  function handleTrackerChange(nextTrackerId: string) {
    setSelectedTracker(nextTrackerId);
    setCategoryId(ALL_FILTER_VALUE);
    setPayeeId(ALL_FILTER_VALUE);
    setEditingTransactionId("");
    setEditState(null);
  }

  function resetFilters() {
    setQuery("");
    setDirection(ALL_FILTER_VALUE);
    setCategoryId(ALL_FILTER_VALUE);
    setPayeeId(ALL_FILTER_VALUE);
    setFrom("");
    setTo("");
  }

  function startEdit(item: Transaction) {
    setEditingTransactionId(item.id);
    setEditState({
      date: item.date,
      amount: amountToInputValue(item.amountCents),
      direction: item.direction,
      categoryId: item.categoryId ?? "",
      payeeId: item.payeeId ?? EMPTY_SELECT_VALUE,
      customPayeeName: item.customPayeeName ?? "",
      notes: item.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingTransactionId("");
    setEditState(null);
  }

  function submitEdit(id: string) {
    if (!editState) return;

    if (!editState.date || !editState.amount.trim() || !editState.categoryId) {
      toast.error("Datum, Betrag und Kategorie sind Pflichtfelder");
      return;
    }

    updateMutation.mutate({
      id,
      payload: {
        date: editState.date,
        amount: editState.amount,
        direction: editState.direction,
        categoryId: editState.categoryId,
        payeeId:
          editState.payeeId === EMPTY_SELECT_VALUE ? null : editState.payeeId,
        customPayeeName: editState.customPayeeName.trim() || null,
        notes: editState.notes.trim() || null,
      },
    });
  }

  const trackers = trackersQuery.data?.items || [];
  const transactionItems = transactionsQuery.data?.items || [];

  return (
    <div className="space-y-4">
      {/* Tracker pills */}
      {trackers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {trackers.map((item) => {
            const isActive = item.id === activeTrackerId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTrackerChange(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "border-transparent bg-foreground text-background shadow-sm"
                    : "border-border/70 bg-background/75 text-foreground hover:bg-accent",
                )}
              >
                {item.color ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                ) : null}
                {item.name}
                {!item.isActive ? " (Archiv)" : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-emerald-500/12 via-emerald-500/6 to-transparent p-3">
          <p className="text-xs text-muted-foreground">Einnahmen</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">
            {formatCurrency(totals.incomeCents, currency, locale)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-rose-500/12 via-rose-500/6 to-transparent p-3">
          <p className="text-xs text-muted-foreground">Ausgaben</p>
          <p className="mt-1 text-xl font-semibold text-rose-600">
            {formatCurrency(totals.expenseCents, currency, locale)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/12 via-primary/6 to-transparent p-3">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold",
              balance >= 0 ? "text-foreground" : "text-rose-600",
            )}
          >
            {formatCurrency(balance, currency, locale)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Filter</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 text-xs"
          >
            Zurücksetzen
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Suche nach Einzahler, Kategorie, Notiz"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger>
              <SelectValue placeholder="Alle Typen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Alle Typen</SelectItem>
              <SelectItem value="expense">Ausgaben</SelectItem>
              <SelectItem value="income">Einnahmen</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Alle Kategorien</SelectItem>
              {(categoriesQuery.data?.items || []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={payeeId} onValueChange={setPayeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Alle Einzahler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Alle Einzahler</SelectItem>
              {(payeesQuery.data?.items || []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Transaction table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Historie</p>
          <span className="text-xs text-muted-foreground">
            {transactionItems.length} Treffer
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Einzahler</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Notizen</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactionItems.map((item) => {
                const isEditing = editingTransactionId === item.id;
                const isOwnEntry = item.createdByUserId === currentUserId;

                return (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell className="text-sm">{item.date}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm">
                            {item.payeeName || item.customPayeeName || "Anonym"}
                          </p>
                          {isOwnEntry ? (
                            <p className="text-xs text-muted-foreground">
                              Von dir
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.categoryName || "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {item.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            item.direction === "expense"
                              ? "text-rose-600"
                              : "text-emerald-600",
                          )}
                        >
                          {item.direction === "expense" ? "-" : "+"}
                          {formatCurrency(item.amountCents, currency, locale)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => startEdit(item)}
                              disabled={
                                updateMutation.isPending || !tracker?.isActive
                              }
                            >
                              Bearbeiten
                            </Button>
                          ) : null}
                          {item.canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={
                                deleteMutation.isPending || !tracker?.isActive
                              }
                            >
                              Löschen
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isEditing && editState ? (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/20 p-0">
                          <div className="grid gap-4 rounded-xl border border-border/60 bg-background m-3 p-4">
                            <div className="grid gap-4 md:grid-cols-3">
                              <Input
                                type="date"
                                value={editState.date}
                                onChange={(event) =>
                                  setEditState((current) =>
                                    current
                                      ? {
                                          ...current,
                                          date: event.target.value,
                                        }
                                      : current,
                                  )
                                }
                              />
                              <Input
                                value={editState.amount}
                                onChange={(event) =>
                                  setEditState((current) =>
                                    current
                                      ? {
                                          ...current,
                                          amount: event.target.value,
                                        }
                                      : current,
                                  )
                                }
                                placeholder="12,50"
                              />
                              <Select
                                value={editState.direction}
                                onValueChange={(value) =>
                                  setEditState((current) =>
                                    current
                                      ? {
                                          ...current,
                                          direction: value as
                                            | "expense"
                                            | "income",
                                          categoryId: "",
                                        }
                                      : current,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="expense">
                                    Ausgabe
                                  </SelectItem>
                                  <SelectItem value="income">
                                    Einnahme
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <Select
                                value={editState.categoryId || undefined}
                                onValueChange={(value) =>
                                  setEditState((current) =>
                                    current
                                      ? { ...current, categoryId: value }
                                      : current,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Kategorie wählen" />
                                </SelectTrigger>
                                <SelectContent>
                                  {editCategories.map((category) => (
                                    <SelectItem
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={editState.payeeId}
                                onValueChange={(value) =>
                                  setEditState((current) =>
                                    current
                                      ? {
                                          ...current,
                                          payeeId: value,
                                          customPayeeName:
                                            value === EMPTY_SELECT_VALUE
                                              ? current.customPayeeName
                                              : "",
                                        }
                                      : current,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Einzahler wählen" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={EMPTY_SELECT_VALUE}>
                                    Anonym / Freitext
                                  </SelectItem>
                                  {(payeesQuery.data?.items || []).map(
                                    (payee) => (
                                      <SelectItem
                                        key={payee.id}
                                        value={payee.id}
                                      >
                                        {payee.name}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {editState.payeeId === EMPTY_SELECT_VALUE ? (
                              <Input
                                value={editState.customPayeeName}
                                onChange={(event) =>
                                  setEditState((current) =>
                                    current
                                      ? {
                                          ...current,
                                          customPayeeName: event.target.value,
                                        }
                                      : current,
                                  )
                                }
                                placeholder="Einmaliger Einzahler"
                              />
                            ) : null}

                            <Textarea
                              value={editState.notes}
                              onChange={(event) =>
                                setEditState((current) =>
                                  current
                                    ? {
                                        ...current,
                                        notes: event.target.value,
                                      }
                                    : current,
                                )
                              }
                              rows={2}
                              placeholder="Notizen"
                            />

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                              >
                                Abbrechen
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => submitEdit(item.id)}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending
                                  ? "Speichert..."
                                  : "Speichern"}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          {transactionItems.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Keine Transaktionen für die aktuellen Filter gefunden.
            </div>
          ) : null}
          {tracker && !tracker.isActive ? (
            <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              Dieser Tracker ist archiviert. Transaktionen können nicht geändert
              oder gelöscht werden.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
