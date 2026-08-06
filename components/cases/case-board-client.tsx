"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, FileStack, MessageSquare, Plus, RotateCcw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented, type SegmentedItem } from "@/components/ui/segmented";
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
import { CaseFileSheet } from "@/components/cases/case-file-sheet";
import { BulkActionBar, type BulkActionMode } from "@/components/cases/bulk-action-bar";
import { fetchJson } from "@/lib/client-fetch";
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
  batchSubmittedOn: string | null;
  commentCount: number;
  submissionCount: number;
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

type Filters = {
  status?: CaseFileStatus;
  caseType?: CaseType;
  q?: string;
  month?: string;
};

function buildQueryString(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.caseType) params.set("caseType", filters.caseType);
  if (filters.q) params.set("q", filters.q);
  if (filters.month) params.set("month", filters.month);
  return params.toString();
}

type SortKey = "createdAt" | "patientName" | "fileNumber" | "dateOfBirth" | "status" | "batchSubmittedOn";
type SortDir = "asc" | "desc";

function compareNullableStrings(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b);
}

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

  const [statusFilter, setStatusFilter] = useState<CaseFileStatus | "all">("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState<CaseType | "all">("all");
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCaseFile, setEditingCaseFile] = useState<CaseFile | null>(null);

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canCreate = workspace ? canWriteWorkspace(workspace.permission) : false;

  const filters: Filters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      caseType: caseTypeFilter === "all" ? undefined : caseTypeFilter,
      q: search.trim() || undefined,
      month: monthFilter || undefined,
    }),
    [statusFilter, caseTypeFilter, search, monthFilter]
  );

  const caseFilesQuery = useQuery({
    queryKey: ["case-files", workspaceId, filters],
    queryFn: () =>
      fetchJson<{ items: CaseFile[] }>(
        `/api/case-workspaces/${workspaceId}/case-files?${buildQueryString(filters)}`
      ),
  });
  const caseFiles = useMemo(() => caseFilesQuery.data?.items || [], [caseFilesQuery.data]);

  const sortedCaseFiles = useMemo(() => {
    const list = [...caseFiles];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "patientName":
          cmp = a.patientName.localeCompare(b.patientName, locale);
          break;
        case "fileNumber":
          cmp = a.fileNumber.localeCompare(b.fileNumber, locale);
          break;
        case "dateOfBirth":
          cmp = compareNullableStrings(a.dateOfBirth, b.dateOfBirth);
          break;
        case "status":
          cmp = tStatus(a.status).localeCompare(tStatus(b.status), locale);
          break;
        case "batchSubmittedOn":
          cmp = compareNullableStrings(a.batchSubmittedOn, b.batchSubmittedOn);
          break;
        case "createdAt":
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [caseFiles, sortKey, sortDir, locale, tStatus]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const eligibleIds = useMemo(
    () => caseFiles.filter((item) => canCreate && item.status !== "done").map((item) => item.id),
    [caseFiles, canCreate]
  );

  const selectedCaseFiles = useMemo(
    () => caseFiles.filter((item) => selectedIds.has(item.id)),
    [caseFiles, selectedIds]
  );

  const bulkMode: BulkActionMode | null = useMemo(() => {
    if (selectedCaseFiles.length === 0) return null;
    const statuses = new Set(selectedCaseFiles.map((item) => item.status));
    if (statuses.size > 1) return "mixed";
    const status = selectedCaseFiles[0].status;
    if (status === "needs_processing") return "advance";
    if (status === "medizin_controlling") return "medizinControlling";
    if (status === "queued_for_pvs") return "queuedForPvs";
    if (status === "sent_to_pvs") return "sentToPvs";
    return "mixed";
  }, [selectedCaseFiles]);

  function invalidateAndClear() {
    queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
    setSelectedIds(new Set());
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CaseFileStatus }) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.statusUpdateFailed"));
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

  const statusFilterItems: SegmentedItem<CaseFileStatus | "all">[] = [
    { value: "all", label: tStatus("all") },
    ...STATUS_VALUES.map((value) => ({ value, label: tStatus(value) })),
  ];

  const caseTypeFilterItems: SegmentedItem<CaseType | "all">[] = [
    { value: "all", label: tCaseType("all") },
    ...CASE_TYPE_VALUES.map((value) => ({ value, label: tCaseType(value) })),
  ];

  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds));
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
          <Button
            size="sm"
            shape="pill"
            onClick={() => {
              setEditingCaseFile(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("newCaseFile")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              aria-label={t("monthFilterLabel")}
              className="sm:w-44"
            />
            {monthFilter ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("clearMonthFilter")}
                onClick={() => setMonthFilter("")}
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
          onValueChange={setStatusFilter}
          size="sm"
        />
        <Segmented
          label={t("caseTypeFilterLabel")}
          items={caseTypeFilterItems}
          value={caseTypeFilter}
          onValueChange={setCaseTypeFilter}
          size="sm"
        />
      </div>

      {!caseFilesQuery.isLoading && caseFiles.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            canCreate ? (
              <Button onClick={() => setSheetOpen(true)}>
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
                active={sortKey === "batchSubmittedOn"}
                dir={sortDir}
                label={t("table.batch")}
                onClick={() => toggleSort("batchSubmittedOn")}
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
            {sortedCaseFiles.map((caseFile) => (
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
                      disabled={caseFile.status === "done"}
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
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={caseFile.status}
                      onValueChange={(value) => {
                        if (value === "sent_to_pvs" && caseFile.status !== "sent_to_pvs") {
                          sendToPvsMutation.mutate([caseFile.id]);
                          return;
                        }
                        statusMutation.mutate({ id: caseFile.id, status: value as CaseFileStatus });
                      }}
                      disabled={!caseFile.canEdit}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_VALUES.map((value) => (
                          <SelectItem
                            key={value}
                            value={value}
                            disabled={
                              value === "sent_to_pvs" &&
                              caseFile.status !== "medizin_controlling" &&
                              caseFile.status !== "queued_for_pvs" &&
                              caseFile.status !== "sent_to_pvs"
                            }
                          >
                            {tStatus(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  {caseFile.batchSubmittedOn ? formatDateShort(caseFile.batchSubmittedOn, locale) : "–"}
                  {caseFile.submissionCount > 1 ? (
                    <span className="ml-1.5 text-muted-foreground/70">
                      ({t("table.submissionBadge", { count: caseFile.submissionCount })})
                    </span>
                  ) : null}
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

      <BulkActionBar
        selectedCount={selectedIds.size}
        mode={bulkMode}
        isPending={bulkActionPending}
        onClear={() => setSelectedIds(new Set())}
        onAdvance={() => advanceMutation.mutate([...selectedIds])}
        onQueueForPvs={() => queueForPvsMutation.mutate([...selectedIds])}
        onSendToPvs={() => sendToPvsMutation.mutate([...selectedIds])}
        onMarkReturned={() => markReturnedMutation.mutate([...selectedIds])}
        onMarkDone={() => markDoneMutation.mutate([...selectedIds])}
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
