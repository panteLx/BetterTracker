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
  debugEnabled: boolean;
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  defaultLocale: string;
  defaultTimezone: string;
  registrationEnabled: boolean;
};

export function AdminSettingsClient() {
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
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
    },
  });

  const testDiscordMutation = useMutation({
    mutationFn: () =>
      fetchJson("/api/admin/notifications/test-discord", {
        method: "POST",
      }),
    onSuccess: () => toast.success("Testbenachrichtigung gesendet"),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Test fehlgeschlagen"),
  });

  const form = draft || settingsQuery.data?.settings || null;
  if (!form) return null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const currentForm = form;
    if (!currentForm) return;
    patchMutation.mutate(currentForm);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="locale">Locale</Label>
            <Input
              id="locale"
              value={form.defaultLocale}
              onChange={(e) => setDraft({ ...form, defaultLocale: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.defaultTimezone}
              onChange={(e) => setDraft({ ...form, defaultTimezone: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="discordWebhookUrl">Discord Webhook URL</Label>
            <Input
              id="discordWebhookUrl"
              value={form.discordWebhookUrl}
              onChange={(e) => setDraft({ ...form, discordWebhookUrl: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discordPingRoleId">Discord Ping Role ID</Label>
            <Input
              id="discordPingRoleId"
              value={form.discordPingRoleId}
              onChange={(e) => setDraft({ ...form, discordPingRoleId: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
            <div>
              <p className="font-medium">Debug Mode</p>
              <p className="text-sm text-muted-foreground">Erweitertes Logging und Debug-Payloads</p>
            </div>
            <Switch
              checked={form.debugEnabled}
              onCheckedChange={(value) => setDraft({ ...form, debugEnabled: value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
            <div>
              <p className="font-medium">Discord Debug</p>
              <p className="text-sm text-muted-foreground">Zusätzliche Discord-Debugdaten senden</p>
            </div>
            <Switch
              checked={form.discordDebugEnabled}
              onCheckedChange={(value) => setDraft({ ...form, discordDebugEnabled: value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
            <div>
              <p className="font-medium">Registrierung erlaubt</p>
              <p className="text-sm text-muted-foreground">Neue Benutzer dürfen sich registrieren</p>
            </div>
            <Switch
              checked={form.registrationEnabled}
              onCheckedChange={(value) => setDraft({ ...form, registrationEnabled: value })}
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={patchMutation.isPending}>
              Settings speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testDiscordMutation.mutate()}
              disabled={testDiscordMutation.isPending}
            >
              Discord testen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
