"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";

type PreviewEntry = {
  sampleNumber: string;
  patientName: string;
  dateOfBirth: string | null;
  receivedDate: string | null;
  liquid: string | null;
  sender: string | null;
  material: string | null;
  isCancerRegistry: boolean;
  duplicate: boolean;
};

type Preview = {
  periodStart: string | null;
  periodEnd: string | null;
  entries: PreviewEntry[];
};

export function PathologyImportDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Cases.pathology");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [analyzed, setAnalyzed] = useState(false);

  function reset() {
    setFile(null);
    setEntries([]);
    setPeriod({ start: "", end: "" });
    setAnalyzed(false);
  }

  const preview = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("importDialog.noFile"));
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/case-workspaces/${workspaceId}/pathology/import/preview`, {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t("toast.previewFailed"));
      return body as Preview;
    },
    onSuccess: (data) => {
      setEntries(data.entries);
      setPeriod({ start: data.periodStart ?? "", end: data.periodEnd ?? "" });
      setAnalyzed(true);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.previewFailed")),
  });

  const fresh = entries.filter((entry) => !entry.duplicate);
  const cancerCount = entries.filter((entry) => entry.isCancerRegistry).length;
  const duplicateCount = entries.length - fresh.length;

  const commit = useMutation({
    mutationFn: () =>
      fetchJson<{ list: { id: string }; importedCount: number }>(
        `/api/case-workspaces/${workspaceId}/pathology/import`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceFileName: file?.name ?? "import.pdf",
            periodStart: period.start,
            periodEnd: period.end,
            entries: fresh.map(({ duplicate: _duplicate, ...entry }) => {
              void _duplicate;
              return entry;
            }),
          }),
        }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pathology-lists", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["pathology-insurers", workspaceId] });
      toast.success(t("toast.imported", { count: result.importedCount }));
      onOpenChange(false);
      reset();
      router.push(`/cases/${workspaceId}/pathology/${result.list.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.importFailed")),
  });

  function updateEntry(index: number, patch: Partial<PreviewEntry>) {
    setEntries((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  const canCommit = fresh.length > 0 && !!period.start && !!period.end && !commit.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("importDialog.title")}</DialogTitle>
          <DialogDescription>{t("importDialog.description")}</DialogDescription>
        </DialogHeader>

        {!analyzed ? (
          <div className="space-y-2">
            <Label htmlFor="pathology-file">{t("importDialog.fileLabel")}</Label>
            <Input
              id="pathology-file"
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pathology-period-start">{t("importDialog.periodStart")}</Label>
                <Input
                  id="pathology-period-start"
                  type="date"
                  value={period.start}
                  onChange={(event) => setPeriod((p) => ({ ...p, start: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pathology-period-end">{t("importDialog.periodEnd")}</Label>
                <Input
                  id="pathology-period-end"
                  type="date"
                  value={period.end}
                  onChange={(event) => setPeriod((p) => ({ ...p, end: event.target.value }))}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("importDialog.summary", {
                count: entries.length,
                cancer: cancerCount,
                duplicates: duplicateCount,
              })}
            </p>
            {fresh.length === 0 ? (
              <p className="text-sm text-destructive">{t("importDialog.nothingNew")}</p>
            ) : null}
            <div className="max-h-[45vh] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs">
                  <tr>
                    <th className="p-2">{t("list.columns.sample")}</th>
                    <th className="p-2">{t("list.columns.patient")}</th>
                    <th className="p-2">{t("list.columns.material")}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      key={entry.sampleNumber}
                      className={cn(
                        "border-t border-border align-top",
                        entry.duplicate && "opacity-50",
                        entry.isCancerRegistry && !entry.duplicate && "bg-destructive/10"
                      )}
                    >
                      <td className="whitespace-nowrap p-2">{entry.sampleNumber}</td>
                      <td className="p-2">
                        <Input
                          value={entry.patientName}
                          disabled={entry.duplicate}
                          onChange={(event) => updateEntry(index, { patientName: event.target.value })}
                          aria-label={t("list.columns.patient")}
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={entry.material ?? ""}
                          disabled={entry.duplicate}
                          onChange={(event) => updateEntry(index, { material: event.target.value })}
                          aria-label={t("list.columns.material")}
                          className="h-8"
                        />
                      </td>
                      <td className="whitespace-nowrap p-2">
                        {entry.duplicate ? (
                          <Badge variant="outline">{t("importDialog.duplicate")}</Badge>
                        ) : entry.isCancerRegistry ? (
                          <Badge variant="destructive">{t("importDialog.cancerBadge")}</Badge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {analyzed ? (
            <>
              <Button variant="outline" onClick={reset}>
                {t("importDialog.back")}
              </Button>
              <Button disabled={!canCommit} onClick={() => commit.mutate()}>
                {t("importDialog.confirm", { count: fresh.length })}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("importDialog.cancel")}
              </Button>
              <Button disabled={!file || preview.isPending} onClick={() => preview.mutate()}>
                {preview.isPending ? t("importDialog.analyzing") : t("importDialog.analyze")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
