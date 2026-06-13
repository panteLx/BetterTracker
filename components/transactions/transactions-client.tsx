"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Tracker = { id: string; name: string; currency: string };
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

export function TransactionsClient() {
  const queryClient = useQueryClient();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const activeTrackerId = selectedTracker || trackersQuery.data?.items?.[0]?.id || "";

  const transactionsQuery = useQuery({
    queryKey: ["transactions", activeTrackerId, query, direction],
    queryFn: () =>
      fetchJson<{
        items: Transaction[];
        totals: { incomeCents: number; expenseCents: number };
      }>(
        `/api/transactions?trackerId=${activeTrackerId}&q=${encodeURIComponent(query)}${
          direction !== "all" ? `&direction=${direction}` : ""
        }`
      ),
    enabled: Boolean(activeTrackerId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/transactions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Transaktion gelöscht");
      queryClient.invalidateQueries({ queryKey: ["transactions", activeTrackerId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen");
    },
  });

  const currency =
    trackersQuery.data?.items.find((item) => item.id === activeTrackerId)?.currency || "EUR";
  const totals = transactionsQuery.data?.totals ?? { incomeCents: 0, expenseCents: 0 };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Filter</CardTitle>
          </div>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-3">
            <Select value={activeTrackerId} onValueChange={setSelectedTracker}>
              <SelectTrigger className="w-full md:w-52">
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
              placeholder="Suche in Notizen oder Payee"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Alle Typen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="expense">Ausgaben</SelectItem>
                <SelectItem value="income">Einnahmen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Einnahmen</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.incomeCents, currency)}</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ausgaben</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.expenseCents, currency)}</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(totals.incomeCents - totals.expenseCents, currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historie</CardTitle>
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
                  <TableCell>{item.payeeName || item.customPayeeName || "-"}</TableCell>
                  <TableCell>{item.categoryName || "-"}</TableCell>
                  <TableCell className="max-w-sm truncate">{item.notes || "-"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {item.direction === "expense" ? "-" : "+"}
                    {formatCurrency(item.amountCents, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      Löschen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
