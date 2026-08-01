"use client";

import { Fragment, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  ArrowUpRight,
  LayoutList,
  ReceiptText,
  Rows3,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import {
  useLocalStorageValue,
  writeLocalStorageValue,
} from "@/hooks/use-local-storage-value";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { TrackerPillRow } from "@/components/trackers/tracker-pill-row";
import { formatDateShort, formatDayLabel, groupByDate } from "@/lib/utils";
import {
  TransactionEditForm,
  TransactionRowActions,
  useTransactionEdit,
} from "@/components/transactions/transaction-edit";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityIcon } from "@/components/ui/entity-icon";
import { DayGroup, ListRow } from "@/components/ui/list-row";
import { MicroLabel } from "@/components/ui/micro-label";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/components/ui/stat-tile";
import { DatePicker } from "@/components/ui/date-picker";
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
const VIEW_STORAGE_KEY = "bettertracker.transactionsView";

type ViewMode = "list" | "table";

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
  isActive: boolean;
};

type Payee = { id: string; name: string; isActive: boolean };

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
  createdByUserName?: string | null;
  canEdit: boolean;
  canDelete: boolean;
};

type TransactionsClientProps = {
  currentUserId: string;
};

export function TransactionsClient({
  currentUserId,
}: TransactionsClientProps) {
  const locale = useLocale();
  const t = useTranslations("Transactions");
  const commonT = useTranslations("Common");
  const isMobile = useIsMobile();
  // Deep-links (e.g. from the command palette) land on the matching filter.
  // Typing afterwards is purely local state, not synced back to the URL —
  // but a *new* navigation (different q/tracker, including palette searches
  // fired while already on this page) must still take effect, so state is
  // re-seeded whenever the URL's query string actually changes. Comparing
  // during render rather than in an effect avoids an extra commit; see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();
  const [seenParamsKey, setSeenParamsKey] = useState(paramsKey);
  const [selectedTracker, setSelectedTracker] = useState(
    () => searchParams.get("tracker") || "",
  );
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [direction, setDirection] = useState(ALL_FILTER_VALUE);
  const [categoryId, setCategoryId] = useState(ALL_FILTER_VALUE);
  const [payeeId, setPayeeId] = useState(ALL_FILTER_VALUE);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  if (paramsKey !== seenParamsKey) {
    setSeenParamsKey(paramsKey);
    setSelectedTracker(searchParams.get("tracker") || "");
    setQuery(searchParams.get("q") || "");
    setPage(1);
  }
  const storedView = useLocalStorageValue(VIEW_STORAGE_KEY);
  const view: ViewMode = storedView === "table" ? "table" : "list";

  function changeView(next: ViewMode) {
    writeLocalStorageValue(VIEW_STORAGE_KEY, next);
  }

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
      page,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ trackerId: activeTrackerId });

      if (query.trim()) params.set("q", query.trim());
      if (direction !== ALL_FILTER_VALUE) params.set("direction", direction);
      if (categoryId !== ALL_FILTER_VALUE) params.set("categoryId", categoryId);
      if (payeeId !== ALL_FILTER_VALUE) params.set("payeeId", payeeId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));

      return fetchJson<{
        items: Transaction[];
        totals: { incomeCents: number; expenseCents: number };
        totalCount: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      }>(`/api/transactions?${params.toString()}`);
    },
    enabled: Boolean(activeTrackerId),
  });

  const trackerEdit = useTransactionEdit(activeTrackerId);

  const currency = tracker?.currency || "EUR";
  const totals = transactionsQuery.data?.totals ?? {
    incomeCents: 0,
    expenseCents: 0,
  };
  const balance = totals.incomeCents - totals.expenseCents;

  const activeFilterCount = [
    query.trim(),
    direction !== ALL_FILTER_VALUE ? direction : "",
    categoryId !== ALL_FILTER_VALUE ? categoryId : "",
    payeeId !== ALL_FILTER_VALUE ? payeeId : "",
    from,
    to,
  ].filter(Boolean).length;

  function handleTrackerChange(nextTrackerId: string) {
    setSelectedTracker(nextTrackerId);
    setCategoryId(ALL_FILTER_VALUE);
    setPayeeId(ALL_FILTER_VALUE);
    setPage(1);
    trackerEdit.cancelEdit();
  }

  function resetFilters() {
    setQuery("");
    setDirection(ALL_FILTER_VALUE);
    setCategoryId(ALL_FILTER_VALUE);
    setPayeeId(ALL_FILTER_VALUE);
    setFrom("");
    setTo("");
    setPage(1);
  }

  const trackers = trackersQuery.data?.items || [];
  const transactionItems = transactionsQuery.data?.items || [];
  const totalCount =
    transactionsQuery.data?.totalCount ?? transactionItems.length;
  const hasMore = transactionsQuery.data?.hasMore ?? false;
  const dayGroups = groupByDate(transactionItems);
  const isArchived = Boolean(tracker) && !tracker?.isActive;

  function renderEditForm(itemId: string) {
    if (!trackerEdit.editState) return null;
    return (
      <TransactionEditForm
        trackerId={activeTrackerId}
        locale={locale}
        editState={trackerEdit.editState}
        onEditStateChange={(updater) =>
          trackerEdit.setEditState((current) =>
            current ? updater(current) : current,
          )
        }
        categories={categoriesQuery.data?.items || []}
        payees={payeesQuery.data?.items || []}
        onCancel={trackerEdit.cancelEdit}
        onSubmit={() => trackerEdit.submitEdit(itemId)}
        isSaving={trackerEdit.updateMutation.isPending}
      />
    );
  }

  function renderRowActions(item: Transaction) {
    return (
      <TransactionRowActions
        item={item}
        isArchived={isArchived}
        isSaving={trackerEdit.updateMutation.isPending}
        isDeleting={trackerEdit.deleteMutation.isPending}
        locale={locale}
        onToggleEdit={() => trackerEdit.toggleEdit(item)}
        onDelete={() => trackerEdit.deleteMutation.mutate(item.id)}
      />
    );
  }

  const dayLabels = {
    today: commonT("dayLabel.today"),
    yesterday: commonT("dayLabel.yesterday"),
    tomorrow: commonT("dayLabel.tomorrow"),
  };

  const emptyState = (
    <EmptyState
      icon={ReceiptText}
      title={
        activeFilterCount > 0
          ? t("empty.filteredTitle")
          : t("empty.defaultTitle")
      }
      description={
        activeFilterCount > 0
          ? t("empty.filteredDescription")
          : t("empty.defaultDescription")
      }
      action={
        activeFilterCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            shape="pill"
            onClick={resetFilters}
          >
            <X className="h-3.5 w-3.5" />
            {t("filters.resetFilters")}
          </Button>
        ) : null
      }
    />
  );

  return (
    <div className="space-y-6">
      {trackers.length > 0 ? (
        <TrackerPillRow
          trackers={trackers}
          activeTrackerId={activeTrackerId}
          onSelect={handleTrackerChange}
        />
      ) : null}

      {/* The balance answers the question the filters are being used to ask,
          so it carries the inverted tile. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label={t("stats.balanceInFilter")}
          tone="inverse"
          icon={Wallet}
          value={
            <Amount
              cents={balance}
              currency={currency}
              locale={locale}
              size="lg"
              tone="none"
            />
          }
          className="col-span-2 lg:col-span-1"
        />
        <StatTile
          label={t("stats.income")}
          icon={ArrowUpRight}
          value={
            <Amount
              cents={totals.incomeCents}
              currency={currency}
              locale={locale}
              size="lg"
              className="text-income"
            />
          }
        />
        <StatTile
          label={t("stats.expenses")}
          icon={ArrowDownLeft}
          value={
            <Amount
              cents={totals.expenseCents}
              currency={currency}
              locale={locale}
              size="lg"
              className="text-expense"
            />
          }
        />
      </div>

      {/* Filters stay on screen: what you are looking at is never hidden
          behind a disclosure you have to remember to open. */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("filters.searchPlaceholder")}
              aria-label={t("filters.searchAriaLabel")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Grouped so the two segmented controls share one line on
              mobile instead of each wrapping onto its own row; `contents`
              dissolves the wrapper back into the flex-wrap row at sm+. */}
          <div className="flex w-full items-center gap-2 sm:contents">
            <Segmented
              label={t("filters.typeFilterLabel")}
              size={isMobile ? "sm" : "md"}
              className="min-w-0 flex-1 sm:flex-none"
              items={[
                { value: ALL_FILTER_VALUE, label: t("filters.all") },
                { value: "expense", label: t("filters.expenses") },
                { value: "income", label: t("filters.income") },
              ]}
              value={direction}
              onValueChange={(value) => {
                setDirection(value);
                setPage(1);
              }}
            />

            <Segmented
              label={t("filters.viewToggleLabel")}
              size={isMobile ? "sm" : "md"}
              className="shrink-0 sm:ml-auto"
              items={[
                { value: "list", label: t("filters.viewList"), icon: LayoutList },
                { value: "table", label: t("filters.viewTable"), icon: Rows3 },
              ]}
              value={view}
              onValueChange={(value) => changeView(value as ViewMode)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={categoryId}
            onValueChange={(value) => {
              setCategoryId(value);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-label={t("filters.categoryFilterLabel")}
              className="min-w-36 flex-1 sm:w-44 sm:flex-none"
            >
              <SelectValue placeholder={t("filters.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{t("filters.allCategories")}</SelectItem>
              {(categoriesQuery.data?.items || []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={payeeId}
            onValueChange={(value) => {
              setPayeeId(value);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-label={t("filters.payeeFilterLabel")}
              className="min-w-36 flex-1 sm:w-44 sm:flex-none"
            >
              <SelectValue placeholder={t("filters.allPayees")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{t("filters.allPayees")}</SelectItem>
              {(payeesQuery.data?.items || []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex min-w-56 flex-1 items-center gap-2 sm:flex-none">
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={from}
              onChange={(value) => {
                setFrom(value);
                setPage(1);
              }}
              placeholder={t("filters.fromPlaceholder")}
              aria-label={t("filters.fromAriaLabel")}
            />
            <span className="text-muted-foreground">–</span>
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={to}
              onChange={(value) => {
                setTo(value);
                setPage(1);
              }}
              placeholder={t("filters.toPlaceholder")}
              aria-label={t("filters.toAriaLabel")}
            />
          </div>

          {activeFilterCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              className="ml-auto"
              onClick={resetFilters}
            >
              <X className="h-3.5 w-3.5" />
              {t("filters.resetFiltersCount", { count: activeFilterCount })}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <MicroLabel>
            {t("results.count", { count: totalCount })}
          </MicroLabel>
          {isArchived ? (
            <span className="font-subtext text-xs text-muted-foreground">
              {t("results.archivedReadOnly")}
            </span>
          ) : null}
        </div>

        {transactionItems.length === 0 ? (
          emptyState
        ) : view === "list" ? (
          <div className="space-y-5">
            {dayGroups.map((group) => (
              <DayGroup
                key={group.date}
                label={formatDayLabel(group.date, locale, dayLabels)}
                total={
                  <Amount
                    cents={group.items.reduce(
                      (sum, item) =>
                        sum +
                        (item.direction === "expense"
                          ? -item.amountCents
                          : item.amountCents),
                      0,
                    )}
                    currency={currency}
                    locale={locale}
                    size="xs"
                    className="text-muted-foreground"
                  />
                }
              >
                {group.items.map((item) => (
                  <ListRow
                    key={item.id}
                    leading={
                      <EntityIcon
                        icon={
                          item.direction === "expense"
                            ? ArrowDownLeft
                            : ArrowUpRight
                        }
                        size="sm"
                        className={
                          item.direction === "expense"
                            ? "bg-expense-muted text-expense"
                            : "bg-income-muted text-income"
                        }
                      />
                    }
                    title={
                      item.payeeName ||
                      item.customPayeeName ||
                      t("row.anonymous")
                    }
                    subtitle={[
                      item.categoryName || t("row.noCategory"),
                      item.notes,
                      item.createdByUserId === currentUserId
                        ? t("row.byYou")
                        : t("row.byUser", {
                            name: item.createdByUserName ?? t("row.unknownUser"),
                          }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={
                      <Amount
                        cents={item.amountCents}
                        currency={currency}
                        locale={locale}
                        direction={item.direction}
                        signed
                        size="sm"
                      />
                    }
                    actions={renderRowActions(item)}
                  >
                    {trackerEdit.editingTransactionId === item.id
                      ? renderEditForm(item.id)
                      : null}
                  </ListRow>
                ))}
              </DayGroup>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.date")}</TableHead>
                  <TableHead>{t("table.payee")}</TableHead>
                  <TableHead>{t("table.category")}</TableHead>
                  <TableHead>{t("table.notes")}</TableHead>
                  <TableHead>{t("table.createdBy")}</TableHead>
                  <TableHead className="text-right">{t("table.amount")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionItems.map((item) => (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell className="font-subtext text-sm text-muted-foreground">
                        {formatDateShort(item.date, locale)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {item.payeeName || item.customPayeeName || "Anonym"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.categoryName || "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-subtext text-sm text-muted-foreground">
                        {item.notes || "—"}
                      </TableCell>
                      <TableCell className="font-subtext text-sm text-muted-foreground">
                        {item.createdByUserId === currentUserId
                          ? "dir"
                          : (item.createdByUserName ?? "Unbekannt")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Amount
                          cents={item.amountCents}
                          currency={currency}
                          locale={locale}
                          direction={item.direction}
                          signed
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="row-actions flex justify-end gap-0.5">
                          {renderRowActions(item)}
                        </div>
                      </TableCell>
                    </TableRow>
                    {trackerEdit.editingTransactionId === item.id ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="h-auto p-3">
                          {renderEditForm(item.id)}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {transactionItems.length > 0 ? (
          <div className="flex items-center justify-between gap-3 px-1 pt-1">
            <span className="font-subtext text-xs text-muted-foreground">
              Seite {page}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                shape="pill"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || transactionsQuery.isFetching}
              >
                {t("pagination.back")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                shape="pill"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasMore || transactionsQuery.isFetching}
              >
                {t("pagination.next")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
