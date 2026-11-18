"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowLeft, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIsoDate } from "@/components/cases/pathology-format";
import { fetchJson } from "@/lib/client-fetch";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type Treatment = "stat" | "hybrid" | "aop";
const TREATMENTS: Treatment[] = ["stat", "hybrid", "aop"];

type Entry = {
  id: string;
  sampleNumber: string;
  patientName: string;
  dateOfBirth: string | null;
  receivedDate: string | null;
  material: string | null;
  isCancerRegistry: boolean;
  treatmentType: Treatment | null;
  insurer: string | null;
  insuranceNumber: string | null;
  note: string | null;
};

type ListDetail = {
  id: string;
  periodStart: string;
  periodEnd: string;
  isArchived: boolean;
  entries: Entry[];
};

type EntryPatch = Partial<
  Pick<Entry, "treatmentType" | "insurer" | "insuranceNumber" | "note" | "isCancerRegistry">
>;

type CaseWorkspace = {
  id: string;
  isActive: boolean;
  permission: "owner" | "admin" | "write" | "read";
};

const hasText = (value: string | null) => !!value && value.trim().length > 0;
const isComplete = (entry: Entry) => hasText(entry.insurer) && hasText(entry.insuranceNumber);

function TextCell({
  value,
  disabled,
  placeholder,
  list,
  label,
  onCommit,
}: {
  value: string | null;
  disabled: boolean;
  placeholder: string;
  list?: string;
  label: string;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value ?? "");
  return (
    <Input
      value={text}
      list={list}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={label}
      className="h-8 min-w-32"
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text.trim() !== (value ?? "")) onCommit(text);
      }}
    />
  );
}

function EntryRow({
  entry,
  canEdit,
  onPatch,
}: {
  entry: Entry;
  canEdit: boolean;
  onPatch: (entryId: string, patch: EntryPatch) => void;
}) {
  const t = useTranslations("Cases.pathology.list");
  const locale = useLocale();
  const missing = entry.isCancerRegistry && !isComplete(entry);

  return (
    <tr
      className={cn(
        "border-t border-border align-top",
        entry.isCancerRegistry && "bg-destructive/10"
      )}
    >
      <td className="whitespace-nowrap p-2 text-xs">{entry.sampleNumber}</td>
      <td className="p-2">
        <div className="font-medium">{entry.patientName}</div>
        <div className="text-xs text-muted-foreground">
          *{formatIsoDate(entry.dateOfBirth, locale)}
        </div>
      </td>
      <td className="whitespace-nowrap p-2 text-xs">{formatIsoDate(entry.receivedDate, locale)}</td>
      <td className="p-2 text-xs">{entry.material}</td>
      <td className="p-2 text-center">
        <Checkbox
          checked={entry.isCancerRegistry}
          disabled={!canEdit}
          aria-label={t("columns.cancerRegistry")}
          onCheckedChange={(checked) => onPatch(entry.id, { isCancerRegistry: checked === true })}
        />
        {missing ? (
          <Badge variant="destructive" className="mt-1">
            {t("missing")}
          </Badge>
        ) : null}
      </td>
      <td className="p-2">
        <Select
          value={entry.treatmentType ?? "none"}
          disabled={!canEdit}
          onValueChange={(value) =>
            onPatch(entry.id, { treatmentType: value === "none" ? null : (value as Treatment) })
          }
        >
          <SelectTrigger size="sm" aria-label={t("columns.treatment")} className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("treatment.none")}</SelectItem>
            {TREATMENTS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`treatment.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <TextCell
          value={entry.insuranceNumber}
          disabled={!canEdit}
          placeholder={t("numberPlaceholder")}
          label={t("columns.insuranceNumber")}
          onCommit={(value) => onPatch(entry.id, { insuranceNumber: value })}
        />
      </td>
      <td className="p-2">
        <TextCell
          value={entry.insurer}
          disabled={!canEdit}
          placeholder={t("insurerPlaceholder")}
          list="pathology-insurers"
          label={t("columns.insurer")}
          onCommit={(value) => onPatch(entry.id, { insurer: value })}
        />
      </td>
      <td className="p-2">
        <TextCell
          value={entry.note}
          disabled={!canEdit}
          placeholder={t("notePlaceholder")}
          label={t("columns.note")}
          onCommit={(value) => onPatch(entry.id, { note: value })}
        />
      </td>
    </tr>
  );
}

export function PathologyListClient({
  workspaceId,
  listId,
}: {
  workspaceId: string;
  listId: string;
}) {
  const t = useTranslations("Cases.pathology");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [exportWarningOpen, setExportWarningOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const listKey = ["pathology-list", workspaceId, listId];
  const base = `/api/case-workspaces/${workspaceId}/pathology`;

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => fetchJson<{ item: ListDetail }>(`${base}/${listId}`),
  });
  const insurersQuery = useQuery({
    queryKey: ["pathology-insurers", workspaceId],
    queryFn: () => fetchJson<{ items: string[] }>(`${base}/insurers`),
  });

  const list = listQuery.data?.item;
  const canEdit =
    !!list &&
    !list.isArchived &&
    !!workspace &&
    canWriteWorkspace(workspace.permission) &&
    workspace.isActive;
  const canArchive = !!workspace && canWriteWorkspace(workspace.permission) && workspace.isActive;

  const patchEntry = useMutation({
    mutationFn: ({ entryId, patch }: { entryId: string; patch: EntryPatch }) =>
      fetchJson<{ item: Entry }>(`${base}/${listId}/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: ({ item }, { patch }) => {
      queryClient.setQueryData<{ item: ListDetail }>(listKey, (current) =>
        current
          ? {
              item: {
                ...current.item,
                entries: current.item.entries.map((entry) =>
                  entry.id === item.id ? { ...entry, ...item } : entry
                ),
              },
            }
          : current
      );
      if (patch.insurer !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["pathology-insurers", workspaceId] });
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.saveFailed"));
      // Remount the rows so inputs fall back to the stored values.
      setResetKey((key) => key + 1);
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const archive = useMutation({
    mutationFn: (isArchived: boolean) =>
      fetchJson(`${base}/${listId}`, { method: "PATCH", body: JSON.stringify({ isArchived }) }),
    onSuccess: (_data, isArchived) => {
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: ["pathology-lists", workspaceId] });
      toast.success(isArchived ? t("toast.archived") : t("toast.unarchived"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.archiveFailed")),
  });

  if (!list) return null;

  const entries = list.entries;
  const filled = entries.filter((entry) => entry.treatmentType && isComplete(entry)).length;
  const openCancer = entries.filter((entry) => entry.isCancerRegistry && !isComplete(entry));

  function runExport() {
    const link = document.createElement("a");
    link.href = `${base}/${listId}/pdf`;
    link.click();
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/cases/${workspaceId}/pathology`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("list.back")}
      </Link>

      <PageHeader
        title={t("card.period", {
          start: formatIsoDate(list.periodStart, locale),
          end: formatIsoDate(list.periodEnd, locale),
        })}
        description={t("list.progress", { filled, total: entries.length })}
        actions={
          <div className="flex flex-wrap gap-2">
            {canArchive ? (
              <Button
                variant="outline"
                size="sm"
                disabled={archive.isPending}
                onClick={() => archive.mutate(!list.isArchived)}
              >
                {list.isArchived ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {list.isArchived ? t("list.unarchive") : t("list.archive")}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => (openCancer.length > 0 ? setExportWarningOpen(true) : runExport())}
            >
              <Download className="h-4 w-4" />
              {t("list.export")}
            </Button>
          </div>
        }
      />

      {list.isArchived ? (
        <p className="text-sm text-muted-foreground">{t("list.archivedNotice")}</p>
      ) : null}

      <datalist id="pathology-insurers">
        {(insurersQuery.data?.items ?? []).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs">
            <tr>
              <th className="p-2">{t("list.columns.sample")}</th>
              <th className="p-2">{t("list.columns.patient")}</th>
              <th className="p-2">{t("list.columns.received")}</th>
              <th className="p-2">{t("list.columns.material")}</th>
              <th className="p-2 text-center">{t("list.columns.cancerRegistry")}</th>
              <th className="p-2">{t("list.columns.treatment")}</th>
              <th className="p-2">{t("list.columns.insuranceNumber")}</th>
              <th className="p-2">{t("list.columns.insurer")}</th>
              <th className="p-2">{t("list.columns.note")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <EntryRow
                key={`${entry.id}-${resetKey}`}
                entry={entry}
                canEdit={canEdit}
                onPatch={(entryId, patch) => patchEntry.mutate({ entryId, patch })}
              />
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={exportWarningOpen} onOpenChange={setExportWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("exportWarning.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("exportWarning.description", { count: openCancer.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {openCancer.map((entry) => (
              <li key={entry.id}>
                {entry.sampleNumber} · {entry.patientName}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("exportWarning.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={runExport}>{t("exportWarning.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
