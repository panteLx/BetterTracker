"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type Tracker = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
};
type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
};
type Payee = { id: string; name: string };
type Transaction = {
  id: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryName?: string | null;
  payeeName?: string | null;
  customPayeeName?: string | null;
  notes?: string | null;
};

type TransactionsClientProps = {
  locale: string;
};

export function TransactionsClient({ locale }: TransactionsClientProps) {
  const queryClient = useQueryClient();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState(ALL_FILTER_VALUE);
  const [categoryId, setCategoryId] = useState(ALL_FILTER_VALUE);
  const [payeeId, setPayeeId] = useState(ALL_FILTER_VALUE);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/transactions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Transaktion geloescht");
      queryClient.invalidateQueries({
        queryKey: ["transactions", activeTrackerId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Loeschen fehlgeschlagen",
      );
    },
  });

  const currency = tracker?.currency || "EUR";
  const totals = transactionsQuery.data?.totals ?? {
    incomeCents: 0,
    expenseCents: 0,
  };

  function handleTrackerChange(nextTrackerId: string) {
    setSelectedTracker(nextTrackerId);
    setCategoryId(ALL_FILTER_VALUE);
    setPayeeId(ALL_FILTER_VALUE);
  }

  function resetFilters() {
    setQuery("");
    setDirection(ALL_FILTER_VALUE);
    setCategoryId(ALL_FILTER_VALUE);
    setPayeeId(ALL_FILTER_VALUE);
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Filter</CardTitle>
            </div>
            <Button
              variant="outline"
              onClick={resetFilters}
              className="md:self-end"
            >
              Filter zuruecksetzen
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Select value={activeTrackerId} onValueChange={handleTrackerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tracker" />
              </SelectTrigger>
              <SelectContent>
                {(trackersQuery.data?.items || []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Suche nach Payee, Kategorie, Notiz oder Konto"
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
                <SelectItem value={ALL_FILTER_VALUE}>
                  Alle Kategorien
                </SelectItem>
                {(categoriesQuery.data?.items || []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={payeeId} onValueChange={setPayeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Payees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Alle Payees</SelectItem>
                {(payeesQuery.data?.items || []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid gap-3 sm:grid-cols-2">
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
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Einnahmen
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(totals.incomeCents, currency, locale)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ausgaben
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(totals.expenseCents, currency, locale)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Saldo
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(
                totals.incomeCents - totals.expenseCents,
                currency,
                locale,
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Historie</CardTitle>
          <p className="text-sm text-muted-foreground">
            {(transactionsQuery.data?.items || []).length} Treffer
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Notizen</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transactionsQuery.data?.items || []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>
                    {item.payeeName || item.customPayeeName || "Anonym"}
                  </TableCell>
                  <TableCell>{item.categoryName || "-"}</TableCell>
                  <TableCell className="max-w-sm truncate">
                    {item.notes || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.direction === "expense" ? "-" : "+"}
                    {formatCurrency(item.amountCents, currency, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending || !tracker?.isActive}
                    >
                      Loeschen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(transactionsQuery.data?.items || []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Keine Transaktionen fuer die aktuellen Filter gefunden.
            </p>
          ) : null}
          {tracker && !tracker.isActive ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Dieser Tracker ist archiviert. Transaktionen koennen nicht
              geaendert oder geloescht werden.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
