"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";
import { fetchJson } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Tracker = {
  id: string;
  name: string;
  slug: string;
  color: string;
  currency: string;
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  isActive: boolean;
  isHidden: boolean;
};

type TrackerDraft = Pick<
  Tracker,
  | "name"
  | "color"
  | "currency"
  | "discordWebhookUrl"
  | "discordDebugEnabled"
  | "discordPingRoleId"
  | "isActive"
  | "isHidden"
>;

export function AdminTrackersClient() {
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
      toast.success("Tracker gespeichert");
      queryClient.invalidateQueries({ queryKey: ["admin-trackers"] });
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
    },
  });

  const testDiscordMutation = useMutation({
    mutationFn: (trackerId: string) =>
      fetchJson("/api/admin/notifications/test-discord", {
        method: "POST",
        body: JSON.stringify({ trackerId }),
      }),
    onSuccess: () => toast.success("Testbenachrichtigung gesendet"),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Test fehlgeschlagen"),
  });

  const selfShareMutation = useMutation({
    mutationFn: (trackerId: string) =>
      fetchJson(`/api/admin/trackers/${trackerId}/self-share`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Tracker für dich freigegeben");
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Freigabe fehlgeschlagen"),
  });

  function updateDraft(id: string, patch: Partial<TrackerDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  function getDraft(item: Tracker): TrackerDraft {
    return {
      name: drafts[item.id]?.name ?? item.name,
      color: drafts[item.id]?.color ?? item.color,
      currency: drafts[item.id]?.currency ?? item.currency,
      discordWebhookUrl: drafts[item.id]?.discordWebhookUrl ?? item.discordWebhookUrl,
      discordDebugEnabled:
        drafts[item.id]?.discordDebugEnabled ?? item.discordDebugEnabled,
      discordPingRoleId: drafts[item.id]?.discordPingRoleId ?? item.discordPingRoleId,
      isActive: drafts[item.id]?.isActive ?? item.isActive,
      isHidden: drafts[item.id]?.isHidden ?? item.isHidden,
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
        <CardTitle>Tracker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {(trackersQuery.data?.items || []).map((item) => {
          const draft = getDraft(item);
          const isExpanded = expandedTrackers[item.id] ?? false;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-border/60"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
                onClick={() => toggleExpanded(item.id)}
              >
                <div className="min-w-0">
                  <p className="font-medium">{draft.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.slug} | {draft.currency} | {draft.isActive ? "Aktiv" : "Archiviert"} |{" "}
                    {draft.isHidden ? "Ausgeblendet" : "Sichtbar"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-xl border border-border/60"
                    style={{ backgroundColor: draft.color }}
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{isExpanded ? "Weniger" : "Bearbeiten"}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
              </button>
              {isExpanded ? (
                <div className="space-y-3 border-t border-border/60 p-4">
                  <div className="space-y-2">
                    <Label htmlFor={`tracker-name-${item.id}`}>Name</Label>
                    <Input
                      id={`tracker-name-${item.id}`}
                      value={draft.name}
                      onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`tracker-currency-${item.id}`}>Waehrung</Label>
                    <Input
                      id={`tracker-currency-${item.id}`}
                      value={draft.currency}
                      onChange={(e) =>
                        updateDraft(item.id, { currency: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`tracker-color-${item.id}`}>Farbe</Label>
                    <TrackerColorPicker
                      id={`tracker-color-${item.id}`}
                      value={draft.color}
                      onChange={(value) => updateDraft(item.id, { color: value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`tracker-role-${item.id}`}>Discord Ping Role ID</Label>
                    <Input
                      id={`tracker-role-${item.id}`}
                      value={draft.discordPingRoleId}
                      onChange={(e) =>
                        updateDraft(item.id, { discordPingRoleId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`tracker-webhook-${item.id}`}>Discord Webhook URL</Label>
                    <Input
                      id={`tracker-webhook-${item.id}`}
                      value={draft.discordWebhookUrl}
                      onChange={(e) =>
                        updateDraft(item.id, { discordWebhookUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
                    <div>
                      <p className="font-medium">Discord Debug</p>
                      <p className="text-sm text-muted-foreground">
                        Zusätzliche Discord-Debugdaten für diesen Tracker senden
                      </p>
                    </div>
                    <Switch
                      checked={draft.discordDebugEnabled}
                      onCheckedChange={(value) =>
                        updateDraft(item.id, { discordDebugEnabled: value })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
                    <div>
                      <p className="font-medium">Tracker aktiv</p>
                      <p className="text-sm text-muted-foreground">
                        Archivierte Tracker bleiben erhalten, sind aber deaktiviert
                      </p>
                    </div>
                    <Switch
                      checked={draft.isActive}
                      onCheckedChange={(value) => updateDraft(item.id, { isActive: value })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
                    <div>
                      <p className="font-medium">Tracker ausblenden</p>
                      <p className="text-sm text-muted-foreground">
                        Ausgeblendete Tracker sind für normale Benutzer nicht mehr sichtbar.
                      </p>
                    </div>
                    <Switch
                      checked={draft.isHidden}
                      onCheckedChange={(value) => updateDraft(item.id, { isHidden: value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() =>
                        patchMutation.mutate({
                          id: item.id,
                          payload: draft,
                        })
                      }
                      disabled={patchMutation.isPending}
                    >
                      Tracker speichern
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testDiscordMutation.mutate(item.id)}
                      disabled={testDiscordMutation.isPending}
                    >
                      Discord testen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => selfShareMutation.mutate(item.id)}
                      disabled={selfShareMutation.isPending}
                    >
                      Mich freigeben
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
