"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { fetchJson } from "@/lib/client-fetch";
import { formatDateTime } from "@/lib/utils";

type CaseFileStatusHistoryEntry = {
  id: string;
  caseFileId: string;
  status: string;
  changedByUserId: string | null;
  changedByName: string | null;
  createdAt: string;
};

export function CaseStatusHistory({
  workspaceId,
  caseFileId,
}: {
  workspaceId: string;
  caseFileId: string;
}) {
  const t = useTranslations("Cases.statusHistory");
  const tStatus = useTranslations("Cases.status");
  const locale = useLocale();

  const historyQuery = useQuery({
    queryKey: ["case-file-status-history", caseFileId],
    queryFn: () =>
      fetchJson<{ items: CaseFileStatusHistoryEntry[] }>(
        `/api/case-workspaces/${workspaceId}/case-files/${caseFileId}/status-history`
      ),
  });

  const entries = historyQuery.data?.items || [];

  return (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border bg-surface-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{tStatus(entry.status)}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(entry.createdAt, locale)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.changedByName || t("unknownActor")}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
