"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  registrationEnabled: boolean;
  loginMessageEnabled: boolean;
  loginMessage: string;
  dashboardMessageEnabled: boolean;
  dashboardMessage: string;
};

export function AdminSettingsClient({
  currentRole,
}: {
  currentRole: "admin" | "superadmin";
}) {
  const t = useTranslations("Admin.settings");
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
      toast.success(t("toasts.saved"));
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("toasts.saveError"),
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
      toast.success(t("toasts.applyDefaultsSuccess", { count: data.updatedCount }));
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("toasts.applyDefaultsError"),
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
            <CardTitle>{t("system.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-2xl border border-border p-4">
              <div>
                <p className="font-medium">{t("system.registrationEnabled.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("system.registrationEnabled.description")}
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

      {currentRole === "superadmin" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("siteMessages.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="space-y-3 rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("siteMessages.login.title")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("siteMessages.login.description")}
                  </p>
                </div>
                <Switch
                  checked={form.loginMessageEnabled}
                  onCheckedChange={(value) =>
                    setDraft({ ...form, loginMessageEnabled: value })
                  }
                />
              </div>
              <Textarea
                value={form.loginMessage}
                onChange={(e) =>
                  setDraft({ ...form, loginMessage: e.target.value })
                }
                placeholder={t("siteMessages.login.placeholder")}
                rows={3}
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("siteMessages.dashboard.title")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("siteMessages.dashboard.description")}
                  </p>
                </div>
                <Switch
                  checked={form.dashboardMessageEnabled}
                  onCheckedChange={(value) =>
                    setDraft({ ...form, dashboardMessageEnabled: value })
                  }
                />
              </div>
              <Textarea
                value={form.dashboardMessage}
                onChange={(e) =>
                  setDraft({ ...form, dashboardMessage: e.target.value })
                }
                placeholder={t("siteMessages.dashboard.placeholder")}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("discord.title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="discordWebhookUrl">
              {t("discord.webhookUrl")}
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
              {t("discord.pingRoleId")}
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
              <p className="font-medium">{t("discord.debug.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("discord.debug.description")}
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
              {t("discord.applyDefaults.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("discord.applyDefaults.description")}
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
              {t("discord.applyDefaults.button")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={patchMutation.isPending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
