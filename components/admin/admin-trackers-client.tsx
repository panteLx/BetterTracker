"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, Globe } from "lucide-react";
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

type Tracker = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  currency: string;
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  isActive: boolean;
  isHidden: boolean;
  isPublic: boolean;
};

type TrackerDraft = Omit<Tracker, "id" | "slug">;

export function AdminTrackersClient() {
  const t = useTranslations("Admin.trackers");
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<TrackerDraft>>>({});
  const [expandedTrackers, setExpandedTrackers] = useState<Record<string, boolean>>({});

  const trackersQuery = useQuery({
    queryKey: ["admin-trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/admin/trackers"),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      fetchJson(`/api/admin/trackers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success(t("toasts.saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-trackers"] });
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toasts.saveError"));
    },
  });

  const testDiscordMutation = useMutation({
    mutationFn: (trackerId: string) =>
      fetchJson("/api/admin/notifications/test-discord", {
        method: "POST",
        body: JSON.stringify({ trackerId }),
      }),
    onSuccess: () => toast.success(t("toasts.testSent")),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("toasts.testError")),
  });

  const selfShareMutation = useMutation({
    mutationFn: (trackerId: string) =>
      fetchJson(`/api/admin/trackers/${trackerId}/self-share`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success(t("toasts.selfShared"));
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("toasts.selfShareError")),
  });

  function updateDraft(id: string, patch: Partial<TrackerDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function getDraft(item: Tracker): TrackerDraft {
    const d = drafts[item.id] ?? {};
    return {
      name: d.name ?? item.name,
      description: d.description !== undefined ? d.description : item.description,
      color: d.color ?? item.color,
      currency: d.currency ?? item.currency,
      discordWebhookUrl: d.discordWebhookUrl ?? item.discordWebhookUrl,
      discordDebugEnabled: d.discordDebugEnabled ?? item.discordDebugEnabled,
      discordPingRoleId: d.discordPingRoleId ?? item.discordPingRoleId,
      isActive: d.isActive ?? item.isActive,
      isHidden: d.isHidden ?? item.isHidden,
      isPublic: d.isPublic ?? item.isPublic,
    };
  }

  function toggleExpanded(id: string) {
    setExpandedTrackers((current) => ({
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
        {(trackersQuery.data?.items || []).map((item) => {
          const draft = getDraft(item);
          const isExpanded = expandedTrackers[item.id] ?? false;

          const statusParts = [
            draft.isActive ? t("status.active") : t("status.archived"),
            draft.isHidden ? t("status.hidden") : t("status.visible"),
            draft.isPublic ? t("status.public") : null,
          ].filter(Boolean).join(" · ");

          return (
            <div key={item.id} className="rounded-xl border border-border">
              {/* Collapsed header */}
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
                      {item.slug} · {draft.currency} · {statusParts}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded ? (
                <div className="space-y-4 border-t border-border p-4">
                  {/* Basics */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`name-${item.id}`}>{t("fields.name")}</Label>
                      <Input
                        id={`name-${item.id}`}
                        value={draft.name}
                        onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`currency-${item.id}`}>{t("fields.currency")}</Label>
                      <Input
                        id={`currency-${item.id}`}
                        value={draft.currency}
                        onChange={(e) =>
                          updateDraft(item.id, { currency: e.target.value.toUpperCase() })
                        }
                      />
                    </div>
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

                  {/* Discord */}
                  <div className="space-y-3 rounded-xl border border-border p-3.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discord</p>
                    <div className="space-y-1.5">
                      <Label htmlFor={`webhook-${item.id}`}>{t("discord.webhookUrl")}</Label>
                      <Input
                        id={`webhook-${item.id}`}
                        value={draft.discordWebhookUrl}
                        onChange={(e) =>
                          updateDraft(item.id, { discordWebhookUrl: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`role-${item.id}`}>{t("discord.pingRoleId")}</Label>
                      <Input
                        id={`role-${item.id}`}
                        value={draft.discordPingRoleId}
                        onChange={(e) =>
                          updateDraft(item.id, { discordPingRoleId: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                      <p className="text-sm">{t("discord.debug")}</p>
                      <Switch
                        checked={draft.discordDebugEnabled}
                        onCheckedChange={(v) => updateDraft(item.id, { discordDebugEnabled: v })}
                      />
                    </div>
                  </div>

                  {/* Status toggles */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium">{t("toggles.archivedTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("toggles.archivedDescription")}</p>
                      </div>
                      <Switch
                        checked={!draft.isActive}
                        onCheckedChange={(v) => updateDraft(item.id, { isActive: !v })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium">{t("toggles.hiddenTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("toggles.hiddenDescription")}</p>
                      </div>
                      <Switch
                        checked={draft.isHidden}
                        onCheckedChange={(v) => updateDraft(item.id, { isHidden: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium">{t("toggles.publicTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("toggles.publicDescription")}</p>
                      </div>
                      <Switch
                        checked={draft.isPublic}
                        onCheckedChange={(v) => updateDraft(item.id, { isPublic: v })}
                      />
                    </div>
                  </div>

                  {/* Public link */}
                  {draft.isPublic ? (
                    <PublicLinkDisplay slug={item.slug} />
                  ) : null}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      onClick={() => patchMutation.mutate({ id: item.id, payload: getDraft(item) })}
                      disabled={patchMutation.isPending}
                    >
                      Speichern
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => selfShareMutation.mutate(item.id)}
                      disabled={selfShareMutation.isPending}
                    >
                      Mich freigeben
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testDiscordMutation.mutate(item.id)}
                      disabled={testDiscordMutation.isPending}
                    >
                      Discord testen
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

function PublicLinkDisplay({ slug }: { slug: string }) {
  const t = useTranslations("Admin.trackers");
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/t/${slug}` : `/t/${slug}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-2.5">
      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</p>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md p-1 hover:bg-muted"
        aria-label={t("publicLink.copyLabel")}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-income" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
