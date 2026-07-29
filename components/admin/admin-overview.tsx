"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/client-fetch";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminOverview() {
  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () =>
      fetchJson<{
        users: number;
        trackers: number;
        transactions: number;
        schedules: number;
        totals: { incomeCents: number; expenseCents: number };
      }>("/api/admin/stats"),
  });

  const stats = statsQuery.data;
  const cards = [
    { label: "Benutzer", value: stats?.users ?? 0 },
    { label: "Tracker", value: stats?.trackers ?? 0 },
    { label: "Transaktionen", value: stats?.transactions ?? 0 },
    { label: "Termine", value: stats?.schedules ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {card.value}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Globale Summen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Einnahmen
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(stats?.totals.incomeCents ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ausgaben
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(stats?.totals.expenseCents ?? 0)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
