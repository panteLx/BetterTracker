"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  BarChart2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/client-fetch";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useChartColors } from "@/lib/chart-colors";

const GERMAN_MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

type Tracker = {
  id: string;
  name: string;
  color: string;
  currency: string;
  isActive: boolean;
};

type CategoryBreakdownItem = {
  categoryId: string | null;
  categoryName: string;
  color: string;
  totalCents: number;
  count: number;
  percentage: number;
};

type PayeeItem = {
  payeeId: string | null;
  payeeName: string;
  totalCents: number;
  count: number;
};

type StatisticsData = {
  year: number;
  summary: {
    incomeCents: number;
    expenseCents: number;
    balanceCents: number;
    transactionCount: number;
  };
  monthly: Array<{
    month: string;
    incomeCents: number;
    expenseCents: number;
  }>;
  categories: {
    expense: CategoryBreakdownItem[];
    income: CategoryBreakdownItem[];
  };
  payees: {
    expense: PayeeItem[];
    income: PayeeItem[];
  };
  balanceTrend: Array<{
    month: string;
    balanceCents: number;
  }>;
};

type StatisticsClientProps = {
  locale: string;
};

function DirectionToggle({
  value,
  onChange,
}: {
  value: "expense" | "income";
  onChange: (v: "expense" | "income") => void;
}) {
  return (
    <div className="flex shrink-0 rounded-md border border-border bg-muted/40 p-0.5 gap-0.5">
      <button
        onClick={() => onChange("expense")}
        className={cn(
          "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
          value === "expense"
            ? "bg-expense text-expense-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Ausgaben
      </button>
      <button
        onClick={() => onChange("income")}
        className={cn(
          "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
          value === "income"
            ? "bg-income text-income-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Einnahmen
      </button>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={cn("mt-1 truncate text-xl font-semibold tracking-tight", colorClass)}>
              {value}
            </p>
          </div>
          <div className={cn("rounded-lg p-2", bgClass)}>
            <Icon className={cn("h-4 w-4", colorClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartTooltipCurrency({
  active,
  payload,
  label,
  currency,
  locale,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency: string;
  locale: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-2.5 text-xs shadow-lg">
      {label && <p className="mb-1.5 font-medium">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatCurrency(p.value, currency, locale)}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-2 text-muted-foreground">
      <AlertCircle className="h-7 w-7 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function CategoryChart({
  items,
  currency,
  locale,
}: {
  items: CategoryBreakdownItem[];
  currency: string;
  locale: string;
}) {
  if (items.length === 0) return <EmptyChart message="Keine Buchungen vorhanden" />;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="shrink-0 self-center">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={items}
              dataKey="totalCents"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
            >
              {items.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as CategoryBreakdownItem;
                return (
                  <div className="rounded-lg border border-border bg-background p-2.5 text-xs shadow-lg">
                    <p className="font-medium">{d.categoryName}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {formatCurrency(d.totalCents, currency, locale)} ({d.percentage}%)
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 min-w-0">
        {items.map((cat) => (
          <li
            key={cat.categoryId ?? "none"}
            className="flex items-center gap-2 text-xs min-w-0"
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            <span className="flex-1 truncate text-muted-foreground">
              {cat.categoryName}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {cat.percentage}%
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {formatCurrency(cat.totalCents, currency, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PayeeChart({
  items,
  direction,
  currency,
  locale,
}: {
  items: PayeeItem[];
  direction: "expense" | "income";
  currency: string;
  locale: string;
}) {
  const chartColors = useChartColors();
  const barColor = direction === "expense" ? chartColors.expense : chartColors.income;
  const dataKey = direction === "expense" ? "Ausgaben" : "Einnahmen";

  const data = items
    .slice(0, 6)
    .map((p) => ({
      name: p.payeeName.length > 20 ? p.payeeName.slice(0, 18) + "…" : p.payeeName,
      [dataKey]: p.totalCents,
    }))
    .reverse();

  if (data.length === 0) return <EmptyChart message="Keine Buchungen vorhanden" />;

  return (
    <ResponsiveContainer width="100%" height={data.length * 36 + 16}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          horizontal={false}
        />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCurrency(v, currency, locale)}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          className="fill-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={90}
          className="fill-muted-foreground"
        />
        <Tooltip
          content={<ChartTooltipCurrency currency={currency} locale={locale} />}
        />
        <Bar dataKey={dataKey} fill={barColor} radius={[0, 3, 3, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatisticsClient({ locale }: StatisticsClientProps) {
  const currentYear = new Date().getFullYear();
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [categoryDirection, setCategoryDirection] = useState<"expense" | "income">("expense");
  const [payeeDirection, setPayeeDirection] = useState<"expense" | "income">("expense");

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const { data: trackers, isLoading: trackersLoading } = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
    select: (data) => data.items.filter((t) => t.isActive),
  });

  const activeTrackerId = selectedTrackerId ?? trackers?.[0]?.id ?? null;
  const activeTracker = trackers?.find((t) => t.id === activeTrackerId);
  const currency = activeTracker?.currency ?? "EUR";

  const { data: stats, isLoading: statsLoading } = useQuery<StatisticsData>({
    queryKey: ["statistics", activeTrackerId, selectedYear],
    queryFn: () =>
      fetchJson<StatisticsData>(
        `/api/statistics?trackerId=${activeTrackerId}&year=${selectedYear}`
      ),
    enabled: !!activeTrackerId,
  });

  const monthlyChartData = useMemo(
    () =>
      stats?.monthly.map((m, i) => ({
        name: GERMAN_MONTHS[i],
        Einnahmen: m.incomeCents,
        Ausgaben: m.expenseCents,
      })) ?? [],
    [stats]
  );

  const balanceTrendData = useMemo(
    () =>
      stats?.balanceTrend.map((b, i) => ({
        name: GERMAN_MONTHS[i],
        Kontostand: b.balanceCents,
      })) ?? [],
    [stats]
  );

  const colors = useChartColors();
  const hasData = (stats?.summary.transactionCount ?? 0) > 0;
  const isLoading = trackersLoading || (!!activeTrackerId && statsLoading);


  if (!trackers?.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/50">
          <BarChart2 className="h-5 w-5" />
        </div>
        <p className="text-sm">Kein Tracker vorhanden.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={activeTrackerId ?? ""}
          onValueChange={(v) => setSelectedTrackerId(v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tracker wählen" />
          </SelectTrigger>
          <SelectContent>
            {trackers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(parseInt(v))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
        </div>
      ) : !hasData ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/50">
            <BarChart2 className="h-5 w-5" />
          </div>
          <p className="text-sm">Keine Buchungen für {selectedYear} gefunden.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              title="Einnahmen"
              value={formatCurrency(stats!.summary.incomeCents, currency, locale)}
              icon={TrendingUp}
              colorClass="text-income"
              bgClass="bg-income-muted"
            />
            <SummaryCard
              title="Ausgaben"
              value={formatCurrency(stats!.summary.expenseCents, currency, locale)}
              icon={TrendingDown}
              colorClass="text-expense"
              bgClass="bg-expense-muted"
            />
            <SummaryCard
              title="Saldo"
              value={formatCurrency(stats!.summary.balanceCents, currency, locale)}
              icon={Wallet}
              colorClass={
                stats!.summary.balanceCents >= 0
                  ? "text-income"
                  : "text-expense"
              }
              bgClass={
                stats!.summary.balanceCents >= 0
                  ? "bg-income-muted"
                  : "bg-expense-muted"
              }
            />
            <SummaryCard
              title="Buchungen"
              value={String(stats!.summary.transactionCount)}
              icon={Receipt}
              colorClass="text-foreground"
              bgClass="bg-muted"
            />
          </div>

          {/* Monthly Overview */}
          <Card>
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle className="text-sm font-medium">
                Monatsübersicht {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v, currency, locale)}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    content={
                      <ChartTooltipCurrency currency={currency} locale={locale} />
                    }
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="Einnahmen"
                    fill={colors.income}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                  <Bar
                    dataKey="Ausgaben"
                    fill={colors.expense}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category + Payees */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Category Breakdown */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    Nach Kategorie
                  </CardTitle>
                  <DirectionToggle
                    value={categoryDirection}
                    onChange={setCategoryDirection}
                  />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-5">
                <CategoryChart
                  items={stats!.categories?.[categoryDirection] ?? []}
                  currency={currency}
                  locale={locale}
                />
              </CardContent>
            </Card>

            {/* Top Payees */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    Top Empfänger
                  </CardTitle>
                  <DirectionToggle
                    value={payeeDirection}
                    onChange={setPayeeDirection}
                  />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-4 sm:px-4">
                <PayeeChart
                  items={stats!.payees?.[payeeDirection] ?? []}
                  direction={payeeDirection}
                  currency={currency}
                  locale={locale}
                />
              </CardContent>
            </Card>
          </div>

          {/* Balance Trend */}
          <Card>
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle className="text-sm font-medium">
                Kontostand {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={balanceTrendData}
                  margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.income} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={colors.income} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v, currency, locale)}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    content={
                      <ChartTooltipCurrency currency={currency} locale={locale} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="Kontostand"
                    stroke={colors.income}
                    strokeWidth={2}
                    fill="url(#balanceGradient)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
