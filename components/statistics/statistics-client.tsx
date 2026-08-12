"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
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
  ArrowDown,
  ArrowUp,
  BarChart2,
  Flame,
  PiggyBank,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
  Weight,
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
import { cn, formatCurrency, formatDateShort, formatWeight } from "@/lib/utils";
import { useChartColors } from "@/lib/chart-colors";

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
  weightTrackingEnabled?: boolean;
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

type PeriodSummary = {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  transactionCount: number;
};

type StatisticsData = {
  year: number;
  summary: PeriodSummary;
  previousYear: PeriodSummary;
  monthly: Array<{
    month: string;
    incomeCents: number;
    expenseCents: number;
    transactionCount: number;
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
  weekday: Array<{
    weekday: string;
    incomeCents: number;
    expenseCents: number;
  }>;
  topExpense: {
    amountCents: number;
    date: string;
    payeeName: string;
    categoryName: string;
  } | null;
  weight: {
    totalGrams: number;
    previousYearTotalGrams: number;
    byPayee: Array<{
      payeeId: string | null;
      payeeName: string;
      totalGrams: number;
      count: number;
    }>;
  };
};

type Direction = "expense" | "income";

function DirectionFilter({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (value: Direction) => void;
}) {
  const t = useTranslations("Statistics");
  return (
    <Segmented
      label={t("filters.directionLabel")}
      size="sm"
      items={[
        { value: "expense", label: t("filters.expense") },
        { value: "income", label: t("filters.income") },
      ]}
      value={value}
      onValueChange={onChange}
    />
  );
}

/**
 * "% ggü. Vorjahr" — sign and color read against `positiveIsGood`, so a
 * shrinking expense shows green even though its number went down.
 */
function YoyDelta({
  current,
  previous,
  positiveIsGood,
}: {
  current: number;
  previous: number;
  positiveIsGood: boolean;
}) {
  const t = useTranslations("Statistics");

  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        {t("yoyDelta.new")}
      </span>
    );
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(change * 10) / 10;

  if (rounded === 0) {
    return (
      <span className="text-muted-foreground">{t("yoyDelta.noChange")}</span>
    );
  }

  const isIncrease = rounded > 0;
  const isGood = positiveIsGood ? isIncrease : !isIncrease;
  const Icon = isIncrease ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        isGood ? "text-income" : "text-expense",
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {t("yoyDelta.change", { value: Math.abs(rounded) })}
    </span>
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

function ChartTooltipWeight({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
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
            {entry.value} kg
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
  const t = useTranslations("Statistics");

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title={t("emptyState.noBookings.title")}
        description={t("emptyState.noBookings.description")}
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
  const t = useTranslations("Statistics");
  const chartColors = useChartColors();
  const barColor =
    direction === "expense" ? chartColors.expense : chartColors.income;
  const dataKey =
    direction === "expense" ? t("dataKeys.expense") : t("dataKeys.income");

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
        title={t("emptyState.noBookings.title")}
        description={t("emptyState.noBookings.description")}
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

type WeightPayeeItem = {
  payeeId: string | null;
  payeeName: string;
  totalGrams: number;
  count: number;
};

/** Mirrors PayeeChart's layout so the weight breakdown reads as part of the
 * same system rather than a bolted-on chart type. */
function WeightPayeeChart({ items }: { items: WeightPayeeItem[] }) {
  const t = useTranslations("Statistics");
  const colors = useChartColors();
  const dataKey = t("dataKeys.weight");

  const data = items
    .slice(0, 6)
    .map((payee) => ({
      name:
        payee.payeeName.length > 20
          ? `${payee.payeeName.slice(0, 18)}…`
          : payee.payeeName,
      [dataKey]: Math.round((payee.totalGrams / 1000) * 100) / 100,
    }))
    .reverse();

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Weight}
        title={t("emptyState.noWeightData.title")}
        description={t("emptyState.noWeightData.description")}
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
          tickFormatter={(value) => `${value} kg`}
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
          content={<ChartTooltipWeight />}
        />
        <Bar
          dataKey={dataKey}
          fill={colors.chart2}
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatisticsClient() {
  const locale = useLocale();
  const t = useTranslations("Statistics");
  const months = t.raw("months") as string[];
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

  const incomeLabel = t("dataKeys.income");
  const expenseLabel = t("dataKeys.expense");
  const balanceLabel = t("dataKeys.balance");
  const thisYearLabel = t("dataKeys.thisYear");
  const previousYearLabel = t("dataKeys.previousYear");

  const monthlyChartData = useMemo(
    () =>
      stats?.monthly.map((month, index) => ({
        name: months[index],
        [incomeLabel]: month.incomeCents,
        [expenseLabel]: month.expenseCents,
      })) ?? [],
    [stats, months, incomeLabel, expenseLabel],
  );

  const balanceTrendData = useMemo(
    () =>
      stats?.balanceTrend.map((entry, index) => ({
        name: months[index],
        [balanceLabel]: entry.balanceCents,
      })) ?? [],
    [stats, months, balanceLabel],
  );

  const weekdayChartData = useMemo(
    () =>
      stats?.weekday.map((entry) => ({
        name: entry.weekday,
        [incomeLabel]: entry.incomeCents,
        [expenseLabel]: entry.expenseCents,
      })) ?? [],
    [stats, incomeLabel, expenseLabel],
  );

  const yearComparisonData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: t("statTiles.income"),
        [thisYearLabel]: stats.summary.incomeCents,
        [previousYearLabel]: stats.previousYear.incomeCents,
      },
      {
        name: t("statTiles.expenses"),
        [thisYearLabel]: stats.summary.expenseCents,
        [previousYearLabel]: stats.previousYear.expenseCents,
      },
      {
        name: t("statTiles.balance"),
        [thisYearLabel]: stats.summary.balanceCents,
        [previousYearLabel]: stats.previousYear.balanceCents,
      },
    ];
  }, [stats, t, thisYearLabel, previousYearLabel]);

  const savingsRate =
    stats && stats.summary.incomeCents > 0
      ? Math.round(
          ((stats.summary.incomeCents - stats.summary.expenseCents) /
            stats.summary.incomeCents) *
            1000,
        ) / 10
      : null;

  const avgTransactionCents =
    stats && stats.summary.transactionCount > 0
      ? Math.round(
          (stats.summary.incomeCents + stats.summary.expenseCents) /
            stats.summary.transactionCount,
        )
      : 0;

  const colors = useChartColors();
  const hasData = (stats?.summary.transactionCount ?? 0) > 0;
  const isLoading = trackersLoading || (!!activeTrackerId && statsLoading);

  if (!trackers?.length) {
    return (
      <EmptyState
        icon={BarChart2}
        title={t("emptyState.noTracker.title")}
        description={t("emptyState.noTracker.description")}
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
          <SelectTrigger className="w-48" aria-label={t("filters.trackerLabel")}>
            <SelectValue placeholder={t("filters.trackerLabel")} />
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
          <SelectTrigger className="w-28" aria-label={t("filters.yearLabel")}>
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
          title={t("emptyState.noBookingsInYear.title", { year: selectedYear })}
          description={t("emptyState.noBookingsInYear.description")}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label={t("statTiles.balance")}
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
              sublabel={
                <YoyDelta
                  current={stats!.summary.balanceCents}
                  previous={stats!.previousYear.balanceCents}
                  positiveIsGood
                />
              }
              className="col-span-2 lg:col-span-1"
            />
            <StatTile
              label={t("statTiles.income")}
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
              sublabel={
                <YoyDelta
                  current={stats!.summary.incomeCents}
                  previous={stats!.previousYear.incomeCents}
                  positiveIsGood
                />
              }
            />
            <StatTile
              label={t("statTiles.expenses")}
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
              sublabel={
                <YoyDelta
                  current={stats!.summary.expenseCents}
                  previous={stats!.previousYear.expenseCents}
                  positiveIsGood={false}
                />
              }
            />
            <StatTile
              label={t("statTiles.transactions")}
              icon={Receipt}
              value={stats!.summary.transactionCount}
              sublabel={
                <YoyDelta
                  current={stats!.summary.transactionCount}
                  previous={stats!.previousYear.transactionCount}
                  positiveIsGood
                />
              }
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <div
            className={cn(
              "grid grid-cols-2 gap-3",
              activeTracker?.weightTrackingEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3",
            )}
          >
            <StatTile
              label={t("statTiles.savingsRate")}
              icon={PiggyBank}
              value={savingsRate === null ? "–" : `${savingsRate} %`}
              helperText={t("statTiles.savingsRateHelper")}
            />
            <StatTile
              label={t("statTiles.avgPerTransaction")}
              icon={Scale}
              value={
                <Amount
                  cents={avgTransactionCents}
                  currency={currency}
                  locale={locale}
                  size="lg"
                  tone="none"
                />
              }
              helperText={t("statTiles.avgPerTransactionHelper")}
            />
            <StatTile
              label={t("statTiles.topExpense")}
              icon={Flame}
              value={
                stats!.topExpense ? (
                  <Amount
                    cents={stats!.topExpense.amountCents}
                    currency={currency}
                    locale={locale}
                    size="lg"
                    direction="expense"
                  />
                ) : (
                  "–"
                )
              }
              helperText={
                stats!.topExpense
                  ? t("statTiles.topExpenseHelper", {
                      payee: stats!.topExpense.payeeName,
                      date: formatDateShort(stats!.topExpense.date, locale),
                    })
                  : t("statTiles.noExpensesThisYear")
              }
              className="col-span-2 lg:col-span-1"
            />
            {activeTracker?.weightTrackingEnabled ? (
              <StatTile
                label={t("statTiles.totalWeight")}
                icon={Weight}
                value={formatWeight(stats!.weight.totalGrams, locale)}
                sublabel={
                  <YoyDelta
                    current={stats!.weight.totalGrams}
                    previous={stats!.weight.previousYearTotalGrams}
                    positiveIsGood
                  />
                }
              />
            ) : null}
          </div>

          <SectionCard title={t("charts.monthly", { year: selectedYear })}>
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
                  dataKey={incomeLabel}
                  fill={colors.income}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey={expenseLabel}
                  fill={colors.expense}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title={t("charts.weekday")}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={weekdayChartData}
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
                  <Bar
                    dataKey={incomeLabel}
                    fill={colors.income}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey={expenseLabel}
                    fill={colors.expense}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title={t("charts.yearComparison")}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={yearComparisonData}
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
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
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
                    dataKey={previousYearLabel}
                    fill="var(--muted-foreground)"
                    fillOpacity={0.35}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey={thisYearLabel}
                    fill={colors.chart1}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard
              title={t("charts.category")}
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
              title={t("charts.payee")}
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

          <SectionCard title={t("charts.balanceTrend", { year: selectedYear })}>
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
                  dataKey={balanceLabel}
                  stroke={colors.chart1}
                  strokeWidth={2}
                  fill="url(#balanceGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          {activeTracker?.weightTrackingEnabled ? (
            <SectionCard title={t("charts.weightByPayee")}>
              <WeightPayeeChart items={stats!.weight.byPayee} />
            </SectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}
