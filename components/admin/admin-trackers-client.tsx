"use client";

import { FormEvent, useState } from "react";
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
>;

export function AdminTrackersClient() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [drafts, setDrafts] = useState<Record<string, Partial<TrackerDraft>>>({});

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJson("/api/trackers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Tracker angelegt");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen");
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      fetchJson(`/api/trackers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Tracker gespeichert");
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
    };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({ name, color });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Neuer Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Farbe</Label>
              <TrackerColorPicker id="color" value={color} onChange={setColor} />
            </div>
            <p className="text-sm text-muted-foreground">
              Neue Tracker uebernehmen die Discord-Defaults aus den Admin-Settings.
            </p>
            <Button className="w-full">Tracker erstellen</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(trackersQuery.data?.items || []).map((item) => {
          const draft = getDraft(item);

          return (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>{draft.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {item.slug} | {draft.isActive ? "Aktiv" : "Archiviert"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
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
                    onChange={(e) => updateDraft(item.id, { currency: e.target.value })}
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
                    onChange={(e) => updateDraft(item.id, { discordPingRoleId: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`tracker-webhook-${item.id}`}>Discord Webhook URL</Label>
                  <Input
                    id={`tracker-webhook-${item.id}`}
                    value={draft.discordWebhookUrl}
                    onChange={(e) => updateDraft(item.id, { discordWebhookUrl: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
                  <div>
                    <p className="font-medium">Discord Debug</p>
                    <p className="text-sm text-muted-foreground">
                      Zusaetzliche Discord-Debugdaten fuer diesen Tracker senden
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
                <div className="md:col-span-2 flex flex-wrap gap-3">
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
