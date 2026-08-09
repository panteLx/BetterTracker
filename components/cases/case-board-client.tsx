"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileStack,
  ListChecks,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Send,
  Stethoscope,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Segmented, type SegmentedItem } from "@/components/ui/segmented";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CaseFileSheet } from "@/components/cases/case-file-sheet";
import { BulkActionBar, type BulkActionMode } from "@/components/cases/bulk-action-bar";
import { fetchJson } from "@/lib/client-fetch";
import { downloadPdfExport } from "@/lib/download-pdf";
import { formatDateShort, formatDateTime } from "@/lib/utils";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";

export type CaseFileStatus =
  | "needs_processing"
  | "medizin_controlling"
  | "queued_for_pvs"
  | "sent_to_pvs"
  | "done";
export type CaseType = "ambulant" | "stationaer" | "konsil";

export type CaseFile = {
  id: string;
  workspaceId: string;
  patientName: string;
  fileNumber: string;
  dateOfBirth: string | null;
  caseType: CaseType;
  status: CaseFileStatus;
  submissionBatchId: string | null;
  commentCount: number;
  lastStatusChangeAt: string;
  returnCount: number;
  lastReturnedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
};

type CaseWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  permission: "owner" | "admin" | "write" | "read";
};

const STATUS_VALUES: CaseFileStatus[] = [
  "needs_processing",
  "medizin_controlling",
  "queued_for_pvs",
  "sent_to_pvs",
  "done",
];
const CASE_TYPE_VALUES: CaseType[] = ["ambulant", "stationaer", "konsil"];
const PDF_EXPORTABLE_STATUSES: CaseFileStatus[] = ["queued_for_pvs", "sent_to_pvs", "done"];

type SortKey =
  | "createdAt"
  | "patientName"
  | "fileNumber"
  | "dateOfBirth"
  | "status"
  | "lastStatusChangeAt";
type SortDir = "asc" | "desc";
const DEFAULT_SORT_KEY: SortKey = "lastStatusChangeAt";
const DEFAULT_SORT_DIR: SortDir = "desc";

type Filters = {
  status?: CaseFileStatus;
  caseType?: CaseType;
  q?: string;
  submittedFrom?: string;
  submittedTo?: string;
  page?: number;
  sortKey?: SortKey;
  sortDir?: SortDir;
};

function buildQueryString(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.caseType) params.set("caseType", filters.caseType);
  if (filters.q) params.set("q", filters.q);
  if (filters.submittedFrom) params.set("submittedFrom", filters.submittedFrom);
  if (filters.submittedTo) params.set("submittedTo", filters.submittedTo);
  params.set("page", String(filters.page ?? 1));
  params.set("sortKey", filters.sortKey ?? DEFAULT_SORT_KEY);
  params.set("sortDir", filters.sortDir ?? DEFAULT_SORT_DIR);
  return params.toString();
}

type FacetCounts<T extends string> = Record<T, number> & { all: number };

type CaseFilesResponse = {
  items: CaseFile[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  statusCounts: FacetCounts<CaseFileStatus>;
  caseTypeCounts: FacetCounts<CaseType>;
};

function SortableHead({
  active,
  dir,
  label,
  onClick,
}: {
  active: boolean;
  dir: SortDir;
  label: string;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className="type-label inline-flex items-center gap-1 uppercase hover:text-foreground"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  );
}

export function CaseBoardClient({
  workspaceId,
}: {
  workspaceId: string;
  currentUserId: string;
}) {
  const t = useTranslations("Cases.board");
  const tStatus = useTranslations("Cases.status");
  const tCaseType = useTranslations("Cases.caseType");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<CaseFileStatus | "all">("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState<CaseType | "all">("all");
  const [search, setSearch] = useState("");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionSpansAllPages, setSelectionSpansAllPages] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCaseFile, setEditingCaseFile] = useState<CaseFile | null>(null);

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canCreate = workspace ? canWriteWorkspace(workspace.permission) : false;

  function openCreateSheet() {
    setEditingCaseFile(null);
    setSheetOpen(true);
  }

  // Lets the Ctrl+K command palette (which lives in the shared cases header,
  // outside this component) trigger case-file creation by navigating here
  // with ?new=case — same idea as the main app's command palette deep-linking
  // into /transactions. Adjusting state during render (rather than in an
  // effect) per https://react.dev/learn/you-might-not-need-an-effect; the
  // actual write is still gated server-side by the create-access guard, so
  // it's fine to open the sheet here before `canCreate` has loaded.
  const newParam = searchParams.get("new");
  const [seenNewParam, setSeenNewParam] = useState(newParam);
  if (newParam !== seenNewParam) {
    setSeenNewParam(newParam);
    if (newParam === "case") {
      openCreateSheet();
    }
  }

  useEffect(() => {
    if (newParam === "case") {
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (!canCreate) return;
      event.preventDefault();
      openCreateSheet();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canCreate]);

  function resetPageAnd<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function handleStatusFilterChange(value: CaseFileStatus | "all") {
    setStatusFilter(value);
    setPage(1);
    // A wide "select all matching" selection is scoped to one status; once
    // the filter moves off that status the selection's meaning no longer
    // holds, so drop it rather than carry it forward silently.
    setSelectedIds(new Set());
    setSelectionSpansAllPages(false);
  }

  const handleCaseTypeFilterChange = resetPageAnd(setCaseTypeFilter);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleSubmittedFromChange(value: string) {
    setSubmittedFrom(value);
    setPage(1);
  }

  function handleSubmittedToChange(value: string) {
    setSubmittedTo(value);
    setPage(1);
  }

  function clearSubmittedRange() {
    setSubmittedFrom("");
    setSubmittedTo("");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const filters: Filters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      caseType: caseTypeFilter === "all" ? undefined : caseTypeFilter,
      q: search.trim() || undefined,
      submittedFrom: submittedFrom || undefined,
      submittedTo: submittedTo || undefined,
      page: page > 1 ? page : undefined,
      sortKey: sortKey !== DEFAULT_SORT_KEY ? sortKey : undefined,
      sortDir: sortKey !== DEFAULT_SORT_KEY || sortDir !== DEFAULT_SORT_DIR ? sortDir : undefined,
    }),
    [statusFilter, caseTypeFilter, search, submittedFrom, submittedTo, page, sortKey, sortDir]
  );

  const caseFilesQuery = useQuery({
    queryKey: ["case-files", workspaceId, filters],
    queryFn: () =>
      fetchJson<CaseFilesResponse>(
        `/api/case-workspaces/${workspaceId}/case-files?${buildQueryString(filters)}`
      ),
  });
  const caseFiles = useMemo(() => caseFilesQuery.data?.items || [], [caseFilesQuery.data]);
  const totalCount = caseFilesQuery.data?.totalCount ?? 0;
  const pageSize = caseFilesQuery.data?.pageSize ?? 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const emptyStatusCounts = useMemo(
    () =>
      ({ all: 0, ...Object.fromEntries(STATUS_VALUES.map((value) => [value, 0])) }) as FacetCounts<CaseFileStatus>,
    []
  );
  const emptyCaseTypeCounts = useMemo(
    () =>
      ({ all: 0, ...Object.fromEntries(CASE_TYPE_VALUES.map((value) => [value, 0])) }) as FacetCounts<CaseType>,
    []
  );
  const statusCounts = caseFilesQuery.data?.statusCounts ?? emptyStatusCounts;
  const caseTypeCounts = caseFilesQuery.data?.caseTypeCounts ?? emptyCaseTypeCounts;

  // "Select all" still targets the workflow-actionable rows (advance/queue/
  // send/etc.) — "done" rows are still selectable individually (for PDF
  // export below), just not swept in by the header checkbox.
  const eligibleIds = useMemo(
    () => caseFiles.filter((item) => canCreate && item.status !== "done").map((item) => item.id),
    [caseFiles, canCreate]
  );

  const selectedCaseFiles = useMemo(
    () => caseFiles.filter((item) => selectedIds.has(item.id)),
    [caseFiles, selectedIds]
  );

  const selectedExportableCaseFiles = useMemo(
    () => selectedCaseFiles.filter((item) => PDF_EXPORTABLE_STATUSES.includes(item.status)),
    [selectedCaseFiles]
  );

  // A wide selection ("all N matching") only ever holds ids for the single
  // active status filter, so bulk mode/exportability can be read straight
  // off that filter instead of per-row lookups — which only exist for
  // whichever page happens to be loaded.
  const exportableCount = selectionSpansAllPages
    ? statusFilter !== "all" && PDF_EXPORTABLE_STATUSES.includes(statusFilter)
      ? selectedIds.size
      : 0
    : selectedExportableCaseFiles.length;

  const bulkMode: BulkActionMode | null = useMemo(() => {
    if (selectedIds.size === 0) return null;
    if (selectionSpansAllPages) {
      if (statusFilter === "needs_processing") return "advance";
      if (statusFilter === "medizin_controlling") return "medizinControlling";
      if (statusFilter === "queued_for_pvs") return "queuedForPvs";
      if (statusFilter === "sent_to_pvs") return "sentToPvs";
      return "mixed";
    }
    const statuses = new Set(selectedCaseFiles.map((item) => item.status));
    if (statuses.size > 1) return "mixed";
    const status = selectedCaseFiles[0]?.status;
    if (status === "needs_processing") return "advance";
    if (status === "medizin_controlling") return "medizinControlling";
    if (status === "queued_for_pvs") return "queuedForPvs";
    if (status === "sent_to_pvs") return "sentToPvs";
    return "mixed";
  }, [selectedIds, selectionSpansAllPages, statusFilter, selectedCaseFiles]);

  function invalidateAndClear() {
    queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["case-file-status-history"] });
    setSelectedIds(new Set());
    setSelectionSpansAllPages(false);
  }

  const selectAllMatchingMutation = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.caseType) params.set("caseType", filters.caseType);
      if (filters.q) params.set("q", filters.q);
      if (filters.submittedFrom) params.set("submittedFrom", filters.submittedFrom);
      if (filters.submittedTo) params.set("submittedTo", filters.submittedTo);
      return fetchJson<{ ids: string[] }>(
        `/api/case-workspaces/${workspaceId}/case-files/ids?${params.toString()}`
      );
    },
    onSuccess: (data) => {
      setSelectedIds(new Set(data.ids));
      setSelectionSpansAllPages(true);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.selectAllFailed"));
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: (caseFileIds: string[]) =>
      downloadPdfExport(
        `/api/case-workspaces/${workspaceId}/case-files/pdf`,
        { caseFileIds },
        "Ausgewaehlte_Akten.pdf"
      ),
    onSuccess: () => {
      setSelectedIds(new Set());
      setSelectionSpansAllPages(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.exportFailed"));
    },
  });

  const advanceMutation = useMutation({
    mutationFn: (caseFileIds: string[]) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files/send-to-medizin-controlling`, {
        method: "POST",
        body: JSON.stringify({ caseFileIds }),
      }),
    onSuccess: () => {
      invalidateAndClear();
      toast.success(t("toast.advanced"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.advanceFailed"));
    },
  });

  const queueForPvsMutation = useMutation({
    mutationFn: (caseFileIds: string[]) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files/mark-queued-for-pvs`, {
        method: "POST",
        body: JSON.stringify({ caseFileIds }),
      }),
    onSuccess: () => {
      invalidateAndClear();
      toast.success(t("toast.queuedForPvs"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.queuedForPvsFailed"));
    },
  });

  const sendToPvsMutation = useMutation({
    mutationFn: (caseFileIds: string[]) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/batches`, {
        method: "POST",
        body: JSON.stringify({ caseFileIds }),
      }),
    onSuccess: () => {
      invalidateAndClear();
      toast.success(t("toast.sentToPvs"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.sentToPvsFailed"));
    },
  });

  const markReturnedMutation = useMutation({
    mutationFn: (caseFileIds: string[]) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files/mark-returned`, {
        method: "POST",
        body: JSON.stringify({ caseFileIds }),
      }),
    onSuccess: () => {
      invalidateAndClear();
      toast.success(t("toast.markedReturned"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.markReturnedFailed"));
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: (caseFileIds: string[]) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files/mark-done`, {
        method: "POST",
        body: JSON.stringify({ caseFileIds }),
      }),
    onSuccess: () => {
      invalidateAndClear();
      toast.success(t("toast.markedDone"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.markDoneFailed"));
    },
  });

  const bulkActionPending =
    advanceMutation.isPending ||
    queueForPvsMutation.isPending ||
    sendToPvsMutation.isPending ||
    markReturnedMutation.isPending ||
    markDoneMutation.isPending;

  function withCount(label: string, count: number) {
    return (
      <>
        {label}
        <span className="text-[10px] tabular-nums text-muted-foreground/70">{count}</span>
      </>
    );
  }

  const statusFilterItems: SegmentedItem<CaseFileStatus | "all">[] = [
    { value: "all", label: withCount(tStatus("all"), statusCounts.all) },
    ...STATUS_VALUES.map((value) => ({
      value,
      label: withCount(tStatus(value), statusCounts[value]),
    })),
  ];

  const caseTypeFilterItems: SegmentedItem<CaseType | "all">[] = [
    { value: "all", label: withCount(tCaseType("all"), caseTypeCounts.all) },
    ...CASE_TYPE_VALUES.map((value) => ({
      value,
      label: withCount(tCaseType(value), caseTypeCounts[value]),
    })),
  ];

  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));
  // Bulk actions need every row to share one status, so the cross-page
  // shortcut only makes sense once the board is already filtered down to a
  // single status — offering it under "all" would silently mix statuses.
  const canOfferSelectAllMatching =
    canCreate &&
    statusFilter !== "all" &&
    allEligibleSelected &&
    !selectionSpansAllPages &&
    totalCount > eligibleIds.length;

  function toggleSelectAll() {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds));
    setSelectionSpansAllPages(false);
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {workspace?.name ?? ""}
          </h1>
          {workspace?.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{workspace.description}</p>
          ) : null}
        </div>
        {canCreate ? (
          <Button size="sm" shape="pill" onClick={openCreateSheet}>
            <Plus className="h-4 w-4" />
            {t("newCaseFile")}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label={t("stats.total")}
          tone="inverse"
          icon={FileStack}
          value={statusCounts.all}
          className="col-span-2 sm:col-span-1"
        />
        <StatTile label={tStatus("needs_processing")} icon={Clock} value={statusCounts.needs_processing} />
        <StatTile
          label={tStatus("medizin_controlling")}
          icon={Stethoscope}
          value={statusCounts.medizin_controlling}
        />
        <StatTile label={tStatus("queued_for_pvs")} icon={ListChecks} value={statusCounts.queued_for_pvs} />
        <StatTile label={tStatus("sent_to_pvs")} icon={Send} value={statusCounts.sent_to_pvs} />
        <StatTile label={tStatus("done")} icon={CheckCircle2} value={statusCounts.done} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="flex min-w-56 items-center gap-1.5 sm:flex-none">
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={submittedFrom}
              onChange={handleSubmittedFromChange}
              placeholder={t("submittedFromPlaceholder")}
              aria-label={t("submittedFromAriaLabel")}
            />
            <span className="text-muted-foreground">–</span>
            <DatePicker
              className="min-w-0 flex-1 sm:w-36 sm:flex-none"
              value={submittedTo}
              onChange={handleSubmittedToChange}
              placeholder={t("submittedToPlaceholder")}
              aria-label={t("submittedToAriaLabel")}
            />
            {submittedFrom || submittedTo ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("clearSubmittedRange")}
                onClick={clearSubmittedRange}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <Segmented
          label={t("statusFilterLabel")}
          items={statusFilterItems}
          value={statusFilter}
          onValueChange={handleStatusFilterChange}
          size="sm"
        />
        <Segmented
          label={t("caseTypeFilterLabel")}
          items={caseTypeFilterItems}
          value={caseTypeFilter}
          onValueChange={handleCaseTypeFilterChange}
          size="sm"
        />
      </div>

      {canOfferSelectAllMatching ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {t("selectAllBanner.pageSelected", { count: eligibleIds.length })}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={selectAllMatchingMutation.isPending}
            onClick={() => selectAllMatchingMutation.mutate()}
          >
            {selectAllMatchingMutation.isPending
              ? t("selectAllBanner.loading")
              : t("selectAllBanner.selectAll", { count: totalCount })}
          </Button>
        </div>
      ) : null}

      {!caseFilesQuery.isLoading && caseFiles.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            canCreate ? (
              <Button onClick={openCreateSheet}>
                <Plus className="h-4 w-4" />
                {t("newCaseFile")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {canCreate ? (
                  <Checkbox
                    checked={allEligibleSelected}
                    onCheckedChange={toggleSelectAll}
                    disabled={eligibleIds.length === 0}
                    aria-label={t("selectAllAria")}
                  />
                ) : null}
              </TableHead>
              <SortableHead
                active={sortKey === "patientName"}
                dir={sortDir}
                label={t("table.patientName")}
                onClick={() => toggleSort("patientName")}
              />
              <SortableHead
                active={sortKey === "fileNumber"}
                dir={sortDir}
                label={t("table.fileNumber")}
                onClick={() => toggleSort("fileNumber")}
              />
              <SortableHead
                active={sortKey === "dateOfBirth"}
                dir={sortDir}
                label={t("table.dateOfBirth")}
                onClick={() => toggleSort("dateOfBirth")}
              />
              <TableHead>{t("table.caseType")}</TableHead>
              <SortableHead
                active={sortKey === "status"}
                dir={sortDir}
                label={t("table.status")}
                onClick={() => toggleSort("status")}
              />
              <SortableHead
                active={sortKey === "lastStatusChangeAt"}
                dir={sortDir}
                label={t("table.lastStatusChangeAt")}
                onClick={() => toggleSort("lastStatusChangeAt")}
              />
              <SortableHead
                active={sortKey === "createdAt"}
                dir={sortDir}
                label={t("table.addedOn")}
                onClick={() => toggleSort("createdAt")}
              />
              <TableHead>{t("table.comments")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {caseFiles.map((caseFile) => (
              <TableRow
                key={caseFile.id}
                className="cursor-pointer"
                onClick={() => {
                  setEditingCaseFile(caseFile);
                  setSheetOpen(true);
                }}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  {canCreate ? (
                    <Checkbox
                      checked={selectedIds.has(caseFile.id)}
                      onCheckedChange={() => toggleRow(caseFile.id)}
                      aria-label={t("selectRowAria", { name: caseFile.patientName })}
                    />
                  ) : null}
                </TableCell>
                <TableCell className="font-medium">{caseFile.patientName}</TableCell>
                <TableCell>{caseFile.fileNumber}</TableCell>
                <TableCell>
                  {caseFile.dateOfBirth ? formatDateShort(caseFile.dateOfBirth, locale) : "–"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{tCaseType(caseFile.caseType)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline">{tStatus(caseFile.status)}</Badge>
                    {caseFile.returnCount > 0 ? (
                      <Badge
                        variant="warning"
                        className="gap-1"
                        title={
                          caseFile.lastReturnedAt
                            ? formatDateTime(caseFile.lastReturnedAt, locale)
                            : undefined
                        }
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t("table.returnedBadge", { count: caseFile.returnCount })}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(caseFile.lastStatusChangeAt, locale)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(caseFile.createdAt, locale)}
                </TableCell>
                <TableCell>
                  {caseFile.commentCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {caseFile.commentCount}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {caseFiles.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
          <span className="font-subtext text-xs text-muted-foreground">
            {t("pagination.summary", { count: totalCount })}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("pagination.pageOf", { page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              shape="pill"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || caseFilesQuery.isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("pagination.back")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              shape="pill"
              onClick={() => setPage((current) => (page < totalPages ? current + 1 : current))}
              disabled={page >= totalPages || caseFilesQuery.isFetching}
            >
              {t("pagination.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <BulkActionBar
        selectedCount={selectedIds.size}
        mode={bulkMode}
        isPending={bulkActionPending}
        onClear={() => {
          setSelectedIds(new Set());
          setSelectionSpansAllPages(false);
        }}
        onAdvance={() => advanceMutation.mutate([...selectedIds])}
        onQueueForPvs={() => queueForPvsMutation.mutate([...selectedIds])}
        onSendToPvs={() => sendToPvsMutation.mutate([...selectedIds])}
        onMarkReturned={() => markReturnedMutation.mutate([...selectedIds])}
        onMarkDone={() => markDoneMutation.mutate([...selectedIds])}
        exportableCount={exportableCount}
        isExporting={exportPdfMutation.isPending}
        onExportPdf={() =>
          exportPdfMutation.mutate(
            selectionSpansAllPages ? [...selectedIds] : selectedExportableCaseFiles.map((item) => item.id)
          )
        }
      />

      <CaseFileSheet
        workspaceId={workspaceId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        caseFile={editingCaseFile}
      />
    </div>
  );
}
