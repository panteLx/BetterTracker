"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FolderClock,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { fetchJson } from "@/lib/client-fetch";
import { formatDateShort } from "@/lib/utils";
import {
  canManageTracker as canManageWorkspace,
  canWriteTracker as canWriteWorkspace,
} from "@/lib/auth/permissions";
import type { CaseFileStatus, CaseType } from "@/components/cases/case-board-client";

type PvsSubmissionBatch = {
  id: string;
  workspaceId: string;
  submittedOn: string;
  createdAt: string;
  isHidden: boolean;
  caseTypeCounts: Record<CaseType, number>;
};

type CaseWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  permission: "owner" | "admin" | "write" | "read";
};

type BatchCaseFile = {
  id: string;
  patientName: string;
  fileNumber: string;
  dateOfBirth: string | null;
  caseType: CaseType;
  status: CaseFileStatus;
};

type BatchDetail = {
  batch: PvsSubmissionBatch;
  groupedByCaseType: Record<CaseType, BatchCaseFile[]>;
};

const CASE_TYPE_VALUES: CaseType[] = ["ambulant", "stationaer", "konsil"];

function BatchRow({
  workspaceId,
  batch,
  canManage,
  canHide,
}: {
  workspaceId: string;
  batch: PvsSubmissionBatch;
  canManage: boolean;
  canHide: boolean;
}) {
  const t = useTranslations("Cases.batches");
  const tStatus = useTranslations("Cases.status");
  const tCaseType = useTranslations("Cases.caseType");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const detailQuery = useQuery({
    queryKey: ["batch-detail", workspaceId, batch.id],
    queryFn: () => fetchJson<BatchDetail>(`/api/case-workspaces/${workspaceId}/batches/${batch.id}`),
    enabled: expanded,
  });

  const eligibleIds = useMemo(() => {
    if (!detailQuery.data) return [];
    return Object.values(detailQuery.data.groupedByCaseType)
      .flat()
      .filter((caseFile) => caseFile.status === "sent_to_pvs")
      .map((caseFile) => caseFile.id);
  }, [detailQuery.data]);

  function invalidateAndClear() {
    queryClient.invalidateQueries({ queryKey: ["batch-detail", workspaceId, batch.id] });
    queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
    setSelectedIds(new Set());
  }

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

  const setHiddenMutation = useMutation({
    mutationFn: (isHidden: boolean) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/batches/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isHidden }),
      }),
    onSuccess: (_data, isHidden) => {
      queryClient.invalidateQueries({ queryKey: ["pvs-batches", workspaceId] });
      toast.success(isHidden ? t("toast.hidden") : t("toast.unhidden"));
    },
    onError: (error, isHidden) => {
      toast.error(
        error instanceof Error ? error.message : isHidden ? t("toast.hideFailed") : t("toast.unhideFailed")
      );
    },
  });

  const bulkActionPending = markDoneMutation.isPending || markReturnedMutation.isPending;

  const totalCount = Object.values(batch.caseTypeCounts).reduce((sum, count) => sum + count, 0);
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));

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
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1.5 pr-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{formatDateShort(batch.submittedOn, locale)}</p>
            <p className="text-xs text-muted-foreground">
              {t("patientCount", { count: totalCount })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {CASE_TYPE_VALUES.filter((type) => batch.caseTypeCounts[type] > 0).map((type) => (
              <Badge key={type} variant="outline">
                {tCaseType(type)} · {batch.caseTypeCounts[type]}
              </Badge>
            ))}
          </div>
        </button>
        {canHide && batch.isHidden ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            shape="pill"
            title={t("unhideBatch")}
            className="shrink-0"
            disabled={setHiddenMutation.isPending}
            onClick={() => setHiddenMutation.mutate(false)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ) : null}
        {canHide && !batch.isHidden ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            shape="pill"
            title={t("hideBatch")}
            className="shrink-0 text-expense hover:bg-expense-muted hover:text-expense"
            disabled={setHiddenMutation.isPending}
            onClick={() => {
              if (window.confirm(t("confirm.hideBatch"))) {
                setHiddenMutation.mutate(true);
              }
            }}
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {canManage && eligibleIds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allEligibleSelected}
                  onCheckedChange={() =>
                    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds))
                  }
                  aria-label={t("selectAllAria")}
                />
                {t("selectAll")}
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.size === 0 || bulkActionPending}
                  onClick={() => markReturnedMutation.mutate([...selectedIds])}
                >
                  <RotateCcw className="h-4 w-4" />
                  {markReturnedMutation.isPending
                    ? t("markingReturned")
                    : t("markReturned", { count: selectedIds.size })}
                </Button>
                <Button
                  size="sm"
                  disabled={selectedIds.size === 0 || bulkActionPending}
                  onClick={() => markDoneMutation.mutate([...selectedIds])}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {markDoneMutation.isPending
                    ? t("markingDone")
                    : t("markDone", { count: selectedIds.size })}
                </Button>
              </div>
            </div>
          ) : null}
          {CASE_TYPE_VALUES.filter((type) => batch.caseTypeCounts[type] > 0).map((type) => (
            <div key={type} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{tCaseType(type)}</span>
                <a
                  href={`/api/case-workspaces/${workspaceId}/batches/${batch.id}/pdf/${type}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-on hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("downloadPdf")}
                </a>
              </div>
              <ul className="space-y-1">
                {(detailQuery.data?.groupedByCaseType[type] || []).map((caseFile) => (
                  <li
                    key={caseFile.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {canManage && caseFile.status === "sent_to_pvs" ? (
                        <Checkbox
                          checked={selectedIds.has(caseFile.id)}
                          onCheckedChange={() => toggleRow(caseFile.id)}
                          aria-label={t("selectRowAria", { name: caseFile.patientName })}
                        />
                      ) : null}
                      <span className="truncate">{caseFile.patientName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      {caseFile.status !== "sent_to_pvs" ? (
                        <Badge variant="outline">{tStatus(caseFile.status)}</Badge>
                      ) : null}
                      {caseFile.fileNumber}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BatchesClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("Cases.batches");
  const [showHidden, setShowHidden] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canManage = workspace ? canWriteWorkspace(workspace.permission) : false;
  const canHide = workspace ? canManageWorkspace(workspace.permission) : false;

  const batchesQuery = useQuery({
    queryKey: ["pvs-batches", workspaceId],
    queryFn: () => fetchJson<{ items: PvsSubmissionBatch[] }>(`/api/case-workspaces/${workspaceId}/batches`),
  });

  const hiddenBatchesQuery = useQuery({
    queryKey: ["pvs-batches", workspaceId, "hidden"],
    queryFn: () =>
      fetchJson<{ items: PvsSubmissionBatch[] }>(`/api/case-workspaces/${workspaceId}/batches?hidden=true`),
    enabled: canHide && showHidden,
  });

  const batches = batchesQuery.data?.items || [];
  const hiddenBatches = hiddenBatchesQuery.data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        {canHide ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowHidden((current) => !current)}
          >
            {showHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showHidden ? t("hideHiddenToggle") : t("showHiddenToggle")}
          </Button>
        ) : null}
      </div>

      {!batchesQuery.isLoading && batches.length === 0 ? (
        <EmptyState icon={FolderClock} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <SectionCard noPadding>
          <div className="space-y-1.5 p-3">
            {batches.map((batch) => (
              <BatchRow
                key={batch.id}
                workspaceId={workspaceId}
                batch={batch}
                canManage={canManage}
                canHide={canHide}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {showHidden ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t("hiddenSectionTitle")}</h2>
          {!hiddenBatchesQuery.isLoading && hiddenBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHidden")}</p>
          ) : (
            <SectionCard noPadding>
              <div className="space-y-1.5 p-3">
                {hiddenBatches.map((batch) => (
                  <BatchRow
                    key={batch.id}
                    workspaceId={workspaceId}
                    batch={batch}
                    canManage={canManage}
                    canHide={canHide}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      ) : null}
    </div>
  );
}
