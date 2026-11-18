"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Microscope, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PathologyImportDialog } from "@/components/cases/pathology-import-dialog";
import { formatIsoDate } from "@/components/cases/pathology-format";
import { fetchJson } from "@/lib/client-fetch";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";

type ListSummary = {
  id: string;
  periodStart: string;
  periodEnd: string;
  sourceFileName: string;
  isArchived: boolean;
  entryCount: number;
  filledCount: number;
  openCancerRegistryCount: number;
};

type CaseWorkspace = {
  id: string;
  isActive: boolean;
  permission: "owner" | "admin" | "write" | "read";
};

export function PathologyListsClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("Cases.pathology");
  const locale = useLocale();
  const [showArchived, setShowArchived] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canEdit = workspace ? canWriteWorkspace(workspace.permission) && workspace.isActive : false;

  const listsQuery = useQuery({
    queryKey: ["pathology-lists", workspaceId, showArchived],
    queryFn: () =>
      fetchJson<{ items: ListSummary[] }>(
        `/api/case-workspaces/${workspaceId}/pathology${showArchived ? "?archived=1" : ""}`
      ),
  });
  const lists = listsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Microscope}
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("import")}
            </Button>
          ) : null
        }
      />

      <div className="flex items-center justify-end gap-2">
        <Switch id="pathology-archived" checked={showArchived} onCheckedChange={setShowArchived} />
        <Label htmlFor="pathology-archived" className="text-sm">
          {t("showArchived")}
        </Label>
      </div>

      {!listsQuery.isLoading && lists.length === 0 ? (
        <EmptyState icon={Microscope} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <SectionCard noPadding>
          <div className="space-y-3 p-3">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/cases/${workspaceId}/pathology/${list.id}`}
                className="block space-y-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {t("card.period", {
                      start: formatIsoDate(list.periodStart, locale),
                      end: formatIsoDate(list.periodEnd, locale),
                    })}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {list.isArchived ? <Badge variant="outline">{t("card.archived")}</Badge> : null}
                    {list.openCancerRegistryCount > 0 ? (
                      <Badge variant="destructive">
                        {t("card.openCancer", { count: list.openCancerRegistryCount })}
                      </Badge>
                    ) : null}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("card.progress", { filled: list.filledCount, total: list.entryCount })}
                  {" · "}
                  {list.sourceFileName}
                </p>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      {canEdit ? (
        <PathologyImportDialog
          workspaceId={workspaceId}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      ) : null}
    </div>
  );
}
