"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Settings = {
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  registrationEnabled: boolean;
};

export function AdminSettingsClient({
  currentRole,
}: {
  currentRole: "admin" | "superadmin";
}) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => fetchJson<{ settings: Settings }>("/api/admin/settings"),
  });

  const [draft, setDraft] = useState<Settings | null>(null);

  const patchMutation = useMutation({
    mutationFn: (payload: Partial<Settings>) =>
      fetchJson("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Settings gespeichert");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Speichern fehlgeschlagen",
      );
    },
  });

  const applyDiscordDefaultsMutation = useMutation({
    mutationFn: (
      payload: Pick<
        Settings,
        "discordWebhookUrl" | "discordDebugEnabled" | "discordPingRoleId"
      >,
    ) =>
      fetchJson<{ updatedCount: number }>(
        "/api/admin/settings/discord/apply-to-trackers",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: (data) => {
      toast.success(`${data.updatedCount} Tracker aktualisiert`);
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Uebernahme fehlgeschlagen",
      );
    },
  });

  const form = draft || settingsQuery.data?.settings || null;
  if (!form) return null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    const payload =
      currentRole === "superadmin"
        ? form
        : {
            discordWebhookUrl: form.discordWebhookUrl,
            discordDebugEnabled: form.discordDebugEnabled,
            discordPingRoleId: form.discordPingRoleId,
          };
    patchMutation.mutate(payload);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {currentRole === "superadmin" ? (
        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-2xl border border-border p-4">
              <div>
                <p className="font-medium">Registrierung erlaubt</p>
                <p className="text-sm text-muted-foreground">
                  Neue Benutzer dürfen sich über die öffentliche Registrierung
                  anmelden.
                </p>
              </div>
              <Switch
                checked={form.registrationEnabled}
                onCheckedChange={(value) =>
                  setDraft({ ...form, registrationEnabled: value })
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Discord</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="discordWebhookUrl">
              Discord-Default Webhook URL
            </Label>
            <Input
              id="discordWebhookUrl"
              value={form.discordWebhookUrl}
              onChange={(e) =>
                setDraft({ ...form, discordWebhookUrl: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discordPingRoleId">
              Discord-Default Ping Role ID
            </Label>
            <Input
              id="discordPingRoleId"
              value={form.discordPingRoleId}
              onChange={(e) =>
                setDraft({ ...form, discordPingRoleId: e.target.value })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border p-4">
            <div>
              <p className="font-medium">Discord-Default Debug</p>
              <p className="text-sm text-muted-foreground">
                Neue Tracker übernehmen diesen Discord-Debug-Standardwert.
              </p>
            </div>
            <Switch
              checked={form.discordDebugEnabled}
              onCheckedChange={(value) =>
                setDraft({ ...form, discordDebugEnabled: value })
              }
            />
          </div>
          <div className="rounded-2xl border border-border p-4 md:col-span-2">
            <p className="font-medium">
              Discord-Defaults auf alle Tracker anwenden
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Uebertraegt Webhook, Ping Role ID und Discord-Debug aus dieser
              Seite in jeden vorhandenen Tracker.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() =>
                applyDiscordDefaultsMutation.mutate({
                  discordWebhookUrl: form.discordWebhookUrl,
                  discordDebugEnabled: form.discordDebugEnabled,
                  discordPingRoleId: form.discordPingRoleId,
                })
              }
              disabled={applyDiscordDefaultsMutation.isPending}
            >
              Auf alle Tracker übernehmen
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={patchMutation.isPending}>
          Settings speichern
        </Button>
      </div>
    </form>
  );
}
