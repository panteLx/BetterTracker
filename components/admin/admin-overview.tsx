"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ReceiptText,
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { Amount } from "@/components/ui/amount";
import { StatTile } from "@/components/ui/stat-tile";

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
  const balanceCents =
    (stats?.totals.incomeCents ?? 0) - (stats?.totals.expenseCents ?? 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Benutzer" icon={Users} value={stats?.users ?? 0} />
        <StatTile label="Tracker" icon={Wallet} value={stats?.trackers ?? 0} />
        <StatTile
          label="Buchungen"
          icon={ReceiptText}
          value={stats?.transactions ?? 0}
        />
        <StatTile
          label="Termine"
          icon={CalendarClock}
          value={stats?.schedules ?? 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Saldo gesamt"
          tone="inverse"
          icon={Wallet}
          value={<Amount cents={balanceCents} size="lg" tone="none" />}
          className="col-span-2 lg:col-span-1"
        />
        <StatTile
          label="Einnahmen gesamt"
          icon={ArrowUpRight}
          value={
            <Amount
              cents={stats?.totals.incomeCents ?? 0}
              size="lg"
              className="text-income"
            />
          }
        />
        <StatTile
          label="Ausgaben gesamt"
          icon={ArrowDownLeft}
          value={
            <Amount
              cents={stats?.totals.expenseCents ?? 0}
              size="lg"
              className="text-expense"
            />
          }
        />
      </div>
    </div>
  );
}
