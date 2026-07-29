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
  ReferenceLine,
} from "recharts";
import {
  BarChart2,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/client-fetch";
import { formatCurrency } from "@/lib/utils";
import { useChartColors } from "@/lib/chart-colors";

const GERMAN_MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

/** Shared axis/grid treatment — recessive, so the marks stay the loudest thing. */
const AXIS_TICK = { fontSize: 11 };
const GRID_PROPS = {
  stroke: "var(--border)",
  vertical: false,
} as const;

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

type Direction = "expense" | "income";

function DirectionFilter({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (value: Direction) => void;
}) {
  return (
    <Segmented
      label="Richtung wählen"
      size="sm"
      items={[
        { value: "expense", label: "Ausgaben" },
        { value: "income", label: "Einnahmen" },
      ]}
      value={value}
      onValueChange={onChange}
    />
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
    <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-overlay">
      {label ? <p className="mb-1.5 font-medium">{label}</p> : null}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums">
            {formatCurrency(entry.value, currency, locale)}
          </span>
        </div>
      ))}
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
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Keine Buchungen"
        description="Für diese Auswahl gibt es in diesem Jahr nichts zu zeigen."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="shrink-0 self-center">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={items}
              dataKey="totalCents"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={74}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {items.map((entry) => (
                <Cell
                  key={entry.categoryId ?? entry.categoryName}
                  fill={entry.color}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as CategoryBreakdownItem;
                return (
                  <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-overlay">
                    <p className="font-medium">{item.categoryName}</p>
                    <p className="mt-0.5 text-muted-foreground tabular-nums">
                      {formatCurrency(item.totalCents, currency, locale)} ·{" "}
                      {item.percentage}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* The legend carries the values, so identity never rests on color
          alone and the slices below 3:1 contrast stay readable. */}
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {items.map((category) => (
          <li
            key={category.categoryId ?? category.categoryName}
            className="flex min-w-0 items-center gap-2 text-xs"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="flex-1 truncate font-subtext text-muted-foreground">
              {category.categoryName}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {category.percentage}%
            </span>
            <span className="w-24 shrink-0 text-right font-subtext text-muted-foreground tabular-nums">
              {formatCurrency(category.totalCents, currency, locale)}
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
  direction: Direction;
  currency: string;
  locale: string;
}) {
  const chartColors = useChartColors();
  const barColor =
    direction === "expense" ? chartColors.expense : chartColors.income;
  const dataKey = direction === "expense" ? "Ausgaben" : "Einnahmen";

  const data = items
    .slice(0, 6)
    .map((payee) => ({
      name:
        payee.payeeName.length > 20
          ? `${payee.payeeName.slice(0, 18)}…`
          : payee.payeeName,
      [dataKey]: payee.totalCents,
    }))
    .reverse();

  if (data.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Keine Buchungen"
        description="Für diese Auswahl gibt es in diesem Jahr nichts zu zeigen."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 24}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(value) => formatCurrency(value, currency, locale)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          className="fill-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={100}
          className="fill-muted-foreground"
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={<ChartTooltipCurrency currency={currency} locale={locale} />}
        />
        <Bar
          dataKey={dataKey}
          fill={barColor}
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatisticsClient({ locale }: StatisticsClientProps) {
  const currentYear = new Date().getFullYear();
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [categoryDirection, setCategoryDirection] = useState<Direction>("expense");
  const [payeeDirection, setPayeeDirection] = useState<Direction>("expense");

  const years = Array.from({ length: 6 }, (_, index) => currentYear - index);

  const { data: trackers, isLoading: trackersLoading } = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
    select: (data) => data.items.filter((item) => item.isActive),
  });

  const activeTrackerId = selectedTrackerId ?? trackers?.[0]?.id ?? null;
  const activeTracker = trackers?.find((item) => item.id === activeTrackerId);
  const currency = activeTracker?.currency ?? "EUR";

  const { data: stats, isLoading: statsLoading } = useQuery<StatisticsData>({
    queryKey: ["statistics", activeTrackerId, selectedYear],
    queryFn: () =>
      fetchJson<StatisticsData>(
        `/api/statistics?trackerId=${activeTrackerId}&year=${selectedYear}`,
      ),
    enabled: !!activeTrackerId,
  });

  const monthlyChartData = useMemo(
    () =>
      stats?.monthly.map((month, index) => ({
        name: GERMAN_MONTHS[index],
        Einnahmen: month.incomeCents,
        Ausgaben: month.expenseCents,
      })) ?? [],
    [stats],
  );

  const balanceTrendData = useMemo(
    () =>
      stats?.balanceTrend.map((entry, index) => ({
        name: GERMAN_MONTHS[index],
        Kontostand: entry.balanceCents,
      })) ?? [],
    [stats],
  );

  const colors = useChartColors();
  const hasData = (stats?.summary.transactionCount ?? 0) > 0;
  const isLoading = trackersLoading || (!!activeTrackerId && statsLoading);

  if (!trackers?.length) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Noch kein Tracker"
        description="Leg auf dem Dashboard einen Tracker an, dann erscheint hier die Auswertung."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters sit in one row above the charts. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={activeTrackerId ?? ""}
          onValueChange={(value) => setSelectedTrackerId(value)}
        >
          <SelectTrigger className="w-48" aria-label="Tracker wählen">
            <SelectValue placeholder="Tracker wählen" />
          </SelectTrigger>
          <SelectContent>
            {trackers.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setSelectedYear(Number.parseInt(value, 10))}
        >
          <SelectTrigger className="w-28" aria-label="Jahr wählen">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={BarChart2}
          title={`Keine Buchungen in ${selectedYear}`}
          description="Wähle ein anderes Jahr oder einen anderen Tracker."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Saldo"
              tone="inverse"
              icon={Wallet}
              value={
                <Amount
                  cents={stats!.summary.balanceCents}
                  currency={currency}
                  locale={locale}
                  size="lg"
                  tone="none"
                />
              }
              className="col-span-2 lg:col-span-1"
            />
            <StatTile
              label="Einnahmen"
              icon={TrendingUp}
              value={
                <Amount
                  cents={stats!.summary.incomeCents}
                  currency={currency}
                  locale={locale}
                  size="lg"
                  className="text-income"
                />
              }
            />
            <StatTile
              label="Ausgaben"
              icon={TrendingDown}
              value={
                <Amount
                  cents={stats!.summary.expenseCents}
                  currency={currency}
                  locale={locale}
                  size="lg"
                  className="text-expense"
                />
              }
            />
            <StatTile
              label="Buchungen"
              icon={Receipt}
              value={stats!.summary.transactionCount}
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <SectionCard title={`Monat für Monat ${selectedYear}`}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={monthlyChartData}
                margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tickFormatter={(value) =>
                    formatCurrency(value, currency, locale)
                  }
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={
                    <ChartTooltipCurrency currency={currency} locale={locale} />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-muted-foreground">{value}</span>
                  )}
                />
                <Bar
                  dataKey="Einnahmen"
                  fill={colors.income}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="Ausgaben"
                  fill={colors.expense}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard
              title="Nach Kategorie"
              titleRight={
                <DirectionFilter
                  value={categoryDirection}
                  onChange={setCategoryDirection}
                />
              }
            >
              <CategoryChart
                items={stats!.categories?.[categoryDirection] ?? []}
                currency={currency}
                locale={locale}
              />
            </SectionCard>

            <SectionCard
              title="Größte Posten"
              titleRight={
                <DirectionFilter
                  value={payeeDirection}
                  onChange={setPayeeDirection}
                />
              }
            >
              <PayeeChart
                items={stats!.payees?.[payeeDirection] ?? []}
                direction={payeeDirection}
                currency={currency}
                locale={locale}
              />
            </SectionCard>
          </div>

          <SectionCard title={`Kontostand ${selectedYear}`}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={balanceTrendData}
                margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={colors.chart1}
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor={colors.chart1}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tickFormatter={(value) =>
                    formatCurrency(value, currency, locale)
                  }
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                  className="fill-muted-foreground"
                />
                {/* Zero is the line that matters on a balance chart. */}
                <ReferenceLine y={0} stroke="var(--border-strong)" />
                <Tooltip
                  content={
                    <ChartTooltipCurrency currency={currency} locale={locale} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="Kontostand"
                  stroke={colors.chart1}
                  strokeWidth={2}
                  fill="url(#balanceGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>
        </>
      )}
    </div>
  );
}
