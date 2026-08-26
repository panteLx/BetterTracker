"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";
import { fetchJson } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type CaseWorkspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  isActive: boolean;
  isHidden: boolean;
};

type CaseWorkspaceDraft = Omit<CaseWorkspace, "id" | "slug">;

export function AdminCaseWorkspacesClient() {
  const t = useTranslations("Admin.caseWorkspaces");
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<CaseWorkspaceDraft>>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const workspacesQuery = useQuery({
    queryKey: ["admin-case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/admin/case-workspaces"),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      fetchJson(`/api/admin/case-workspaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success(t("toasts.saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-case-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["case-workspaces"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toasts.saveError"));
    },
  });

  const selfShareMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      fetchJson(`/api/admin/case-workspaces/${workspaceId}/self-share`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success(t("toasts.selfShared"));
      queryClient.invalidateQueries({ queryKey: ["case-workspaces"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("toasts.selfShareError")),
  });

  function updateDraft(id: string, patch: Partial<CaseWorkspaceDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function getDraft(item: CaseWorkspace): CaseWorkspaceDraft {
    const d = drafts[item.id] ?? {};
    return {
      name: d.name ?? item.name,
      description: d.description !== undefined ? d.description : item.description,
      color: d.color ?? item.color,
      isActive: d.isActive ?? item.isActive,
      isHidden: d.isHidden ?? item.isHidden,
    };
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        {(workspacesQuery.data?.items || []).map((item) => {
          const draft = getDraft(item);
          const isExpanded = expanded[item.id] ?? false;

          const statusParts = [
            draft.isActive ? t("status.active") : t("status.archived"),
            draft.isHidden ? t("status.hidden") : t("status.visible"),
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div key={item.id} className="rounded-xl border border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
                onClick={() => toggleExpanded(item.id)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-7 w-7 shrink-0 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: draft.color }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{draft.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.slug} · {statusParts}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded ? (
                <div className="space-y-4 border-t border-border p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`name-${item.id}`}>{t("fields.name")}</Label>
                    <Input
                      id={`name-${item.id}`}
                      value={draft.name}
                      onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`description-${item.id}`}>{t("fields.description")}</Label>
                    <Textarea
                      id={`description-${item.id}`}
                      value={draft.description ?? ""}
                      onChange={(e) =>
                        updateDraft(item.id, { description: e.target.value || null })
                      }
                      rows={2}
                      placeholder={t("fields.descriptionPlaceholder")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`color-${item.id}`}>{t("fields.color")}</Label>
                    <TrackerColorPicker
                      id={`color-${item.id}`}
                      value={draft.color}
                      onChange={(value) => updateDraft(item.id, { color: value })}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium">{t("toggles.archivedTitle")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("toggles.archivedDescription")}
                        </p>
                      </div>
                      <Switch
                        checked={!draft.isActive}
                        onCheckedChange={(v) => updateDraft(item.id, { isActive: !v })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium">{t("toggles.hiddenTitle")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("toggles.hiddenDescription")}
                        </p>
                      </div>
                      <Switch
                        checked={draft.isHidden}
                        onCheckedChange={(v) => updateDraft(item.id, { isHidden: v })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      onClick={() => patchMutation.mutate({ id: item.id, payload: getDraft(item) })}
                      disabled={patchMutation.isPending}
                    >
                      {t("actions.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => selfShareMutation.mutate(item.id)}
                      disabled={selfShareMutation.isPending}
                    >
                      {t("actions.selfShare")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
