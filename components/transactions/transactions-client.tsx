"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  locale: string;
  currentUserId: string;
};

export function TransactionsClient({
  locale,
  currentUserId,
}: TransactionsClientProps) {
  const isMobile = useIsMobile();
  const [selectedTracker, setSelectedTracker] = useState("");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState(ALL_FILTER_VALUE);
  const [categoryId, setCategoryId] = useState(ALL_FILTER_VALUE);
  const [payeeId, setPayeeId] = useState(ALL_FILTER_VALUE);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
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

  const emptyState = (
    <EmptyState
      icon={ReceiptText}
      title={
        activeFilterCount > 0
          ? "Keine Treffer für diese Filter"
          : "Noch keine Buchungen"
      }
      description={
        activeFilterCount > 0
          ? "Lockere die Filter, um mehr zu sehen."
          : "Leg mit dem Plus-Button die erste Einnahme oder Ausgabe an."
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
            Filter zurücksetzen
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
          label="Saldo im Filter"
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
          label="Einnahmen"
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
          label="Ausgaben"
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
              placeholder="Einzahler, Kategorie oder Notiz suchen"
              aria-label="Buchungen durchsuchen"
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
              label="Nach Typ filtern"
              size={isMobile ? "sm" : "md"}
              className="min-w-0 flex-1 sm:flex-none"
              items={[
                { value: ALL_FILTER_VALUE, label: "Alle" },
                { value: "expense", label: "Ausgaben" },
                { value: "income", label: "Einnahmen" },
              ]}
              value={direction}
              onValueChange={(value) => {
                setDirection(value);
                setPage(1);
              }}
            />

            <Segmented
              label="Ansicht wechseln"
              size={isMobile ? "sm" : "md"}
              className="shrink-0 sm:ml-auto"
              items={[
                { value: "list", label: "Liste", icon: LayoutList },
                { value: "table", label: "Tabelle", icon: Rows3 },
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
              aria-label="Nach Kategorie filtern"
              className="min-w-36 flex-1 sm:w-44 sm:flex-none"
            >
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

          <Select
            value={payeeId}
            onValueChange={(value) => {
              setPayeeId(value);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-label="Nach Einzahler filtern"
              className="min-w-36 flex-1 sm:w-44 sm:flex-none"
            >
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

          <div className="flex min-w-56 flex-1 items-center gap-2 sm:flex-none">
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={from}
              onChange={(value) => {
                setFrom(value);
                setPage(1);
              }}
              placeholder="Von"
              aria-label="Startdatum für Datumsfilter"
            />
            <span className="text-muted-foreground">–</span>
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={to}
              onChange={(value) => {
                setTo(value);
                setPage(1);
              }}
              placeholder="Bis"
              aria-label="Enddatum für Datumsfilter"
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
              {activeFilterCount} Filter zurücksetzen
            </Button>
          ) : null}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <MicroLabel>
            {totalCount === 1 ? "1 Buchung" : `${totalCount} Buchungen`}
          </MicroLabel>
          {isArchived ? (
            <span className="font-subtext text-xs text-muted-foreground">
              Archivierter Tracker — nur lesbar
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
                label={formatDayLabel(group.date, locale)}
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
                    title={item.payeeName || item.customPayeeName || "Anonym"}
                    subtitle={[
                      item.categoryName || "Ohne Kategorie",
                      item.notes,
                      item.createdByUserId === currentUserId
                        ? "von dir"
                        : `von ${item.createdByUserName ?? "Unbekannt"}`,
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
                  <TableHead>Datum</TableHead>
                  <TableHead>Einzahler</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Notizen</TableHead>
                  <TableHead>Erfasst von</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
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
                Zurück
              </Button>
              <Button
                variant="outline"
                size="sm"
                shape="pill"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasMore || transactionsQuery.isFetching}
              >
                Weiter
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
