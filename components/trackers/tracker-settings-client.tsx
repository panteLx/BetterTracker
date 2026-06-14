"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/client-fetch";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";

type Tracker = {
  id: string;
  name: string;
  color: string;
  currency: string;
  description?: string | null;
  discordWebhookUrl: string;
  discordDebugEnabled: boolean;
  discordPingRoleId: string;
  isActive: boolean;
  isHidden?: boolean;
  permission?: "owner" | "write" | "read";
};

type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
};

type Payee = {
  id: string;
  name: string;
};

type TrackerSettingsClientProps = {
  initialTrackerId: string;
  locale: string;
};

function sortByName<T extends { name: string }>(items: T[], locale: string) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, locale),
  );
}

function sortTrackers(items: Tracker[], locale: string) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, locale),
  );
}

export function TrackerSettingsClient({
  initialTrackerId,
  locale,
}: TrackerSettingsClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedTracker, setSelectedTracker] = useState(initialTrackerId);
  const [draft, setDraft] = useState<{
    name?: string;
    color?: string;
    currency?: string;
    description?: string;
    discordWebhookUrl?: string;
    discordPingRoleId?: string;
    discordDebugEnabled?: boolean;
    isActive?: boolean;
  }>({});

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
  });

  const trackers = trackersQuery.data?.items || [];
  const activeTrackerId = selectedTracker || trackers[0]?.id || "";
  const tracker = trackers.find((item) => item.id === activeTrackerId);

  const categoriesQuery = useQuery({
    queryKey: ["categories", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Category[] }>(
        `/api/categories?trackerId=${activeTrackerId}`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const payeesQuery = useQuery({
    queryKey: ["payees", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Payee[] }>(`/api/payees?trackerId=${activeTrackerId}`),
    enabled: Boolean(activeTrackerId),
  });

  const trackerDraft = {
    name: draft.name ?? tracker?.name ?? "",
    color: draft.color ?? tracker?.color ?? DEFAULT_TRACKER_COLOR,
    currency: draft.currency ?? tracker?.currency ?? "EUR",
    description: draft.description ?? tracker?.description ?? "",
    discordWebhookUrl:
      draft.discordWebhookUrl ?? tracker?.discordWebhookUrl ?? "",
    discordPingRoleId:
      draft.discordPingRoleId ?? tracker?.discordPingRoleId ?? "",
    discordDebugEnabled:
      draft.discordDebugEnabled ?? tracker?.discordDebugEnabled ?? false,
    isActive: draft.isActive ?? tracker?.isActive ?? true,
  };

  const categories = useMemo(
    () => sortByName(categoriesQuery.data?.items || [], locale),
    [categoriesQuery.data?.items, locale],
  );
  const payees = useMemo(
    () => sortByName(payeesQuery.data?.items || [], locale),
    [payeesQuery.data?.items, locale],
  );

  const updateTrackerMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      color: string;
      currency: string;
      description: string;
      discordWebhookUrl: string;
      discordPingRoleId: string;
      discordDebugEnabled: boolean;
      isActive: boolean;
    }) =>
      fetchJson<{ item: Tracker }>(`/api/trackers/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          color: payload.color,
          currency: payload.currency,
          description: payload.description || null,
          discordWebhookUrl: payload.discordWebhookUrl,
          discordPingRoleId: payload.discordPingRoleId,
          discordDebugEnabled: payload.discordDebugEnabled,
          isActive: payload.isActive,
        }),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Tracker[] } | undefined>(
        ["trackers"],
        (current) => ({
          items: sortTrackers(
            (current?.items || []).map((entry) =>
              entry.id === item.id ? { ...entry, ...item } : entry,
            ),
            locale,
          ),
        }),
      );
      setDraft({});
      toast.success("Tracker gespeichert");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Tracker konnte nicht gespeichert werden",
      );
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: true }>(`/api/categories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<{ items: Category[] } | undefined>(
        ["categories", activeTrackerId],
        (current) => ({
          items: (current?.items || []).filter((item) => item.id !== deletedId),
        }),
      );
      queryClient.invalidateQueries({
        queryKey: ["transactions", activeTrackerId],
      });
      toast.success("Kategorie geloescht");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kategorie konnte nicht geloescht werden",
      );
    },
  });

  const deletePayeeMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: true }>(`/api/payees/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<{ items: Payee[] } | undefined>(
        ["payees", activeTrackerId],
        (current) => ({
          items: (current?.items || []).filter((item) => item.id !== deletedId),
        }),
      );
      queryClient.invalidateQueries({
        queryKey: ["transactions", activeTrackerId],
      });
      toast.success("Payee geloescht");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Payee konnte nicht geloescht werden",
      );
    },
  });

  function handleTrackerChange(nextTrackerId: string) {
    setSelectedTracker(nextTrackerId);
    setDraft({});
    router.push(`/trackers/${nextTrackerId}/settings`);
  }

  function handleTrackerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tracker) {
      toast.error("Kein Tracker aktiv");
      return;
    }

    if (!trackerDraft.name.trim()) {
      toast.error("Bitte einen Tracker-Namen eingeben");
      return;
    }

    updateTrackerMutation.mutate({
      id: tracker.id,
      name: trackerDraft.name.trim(),
      color: trackerDraft.color,
      currency: trackerDraft.currency.trim() || "EUR",
      description: trackerDraft.description.trim(),
      discordWebhookUrl: trackerDraft.discordWebhookUrl.trim(),
      discordPingRoleId: trackerDraft.discordPingRoleId.trim(),
      discordDebugEnabled: trackerDraft.discordDebugEnabled,
      isActive: trackerDraft.isActive,
    });
  }

  function handleDeleteCategory(id: string, name: string) {
    if (!window.confirm(`Kategorie "${name}" wirklich loeschen?`)) {
      return;
    }

    deleteCategoryMutation.mutate(id);
  }

  function handleDeletePayee(id: string, name: string) {
    if (!window.confirm(`Payee "${name}" wirklich loeschen?`)) {
      return;
    }

    deletePayeeMutation.mutate(id);
  }

  if (!trackersQuery.isLoading && !tracker) {
    return (
      <Card>
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-muted p-3">
            <Settings2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Kein Tracker verfuegbar</p>
            <p className="text-sm text-muted-foreground">
              Lege zuerst einen Tracker an, bevor du die Settings verwaltest.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Zurueck zu den Buchungen</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Tracker waehlen</CardTitle>
            </div>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Zurueck zu den Buchungen
              </Link>
            </Button>
          </div>
          <Select value={activeTrackerId} onValueChange={handleTrackerChange}>
            <SelectTrigger className="max-w-xl">
              <SelectValue placeholder="Tracker waehlen" />
            </SelectTrigger>
            <SelectContent>
              {trackers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      {tracker ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Tracker-Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTrackerSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tracker-name">Name</Label>
                  <Input
                    id="tracker-name"
                    value={trackerDraft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tracker-description">Beschreibung</Label>
                  <Textarea
                    id="tracker-description"
                    value={trackerDraft.description}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Optionaler Kontext fuer diesen Tracker"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tracker-color">Farbe</Label>
                  <TrackerColorPicker
                    id="tracker-color"
                    value={trackerDraft.color}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        color: value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tracker-currency">Waehrung</Label>
                  <Input
                    id="tracker-currency"
                    value={trackerDraft.currency}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        currency: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tracker-webhook">Discord Webhook URL</Label>
                  <Input
                    id="tracker-webhook"
                    value={trackerDraft.discordWebhookUrl}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        discordWebhookUrl: event.target.value,
                      }))
                    }
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tracker-role">Discord Ping Role ID</Label>
                  <Input
                    id="tracker-role"
                    value={trackerDraft.discordPingRoleId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        discordPingRoleId: event.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-medium">Discord Debug</p>
                      <p className="text-xs text-muted-foreground">
                        Zusatzinfos in Benachrichtigungen mitsenden.
                      </p>
                    </div>
                    <Switch
                      checked={trackerDraft.discordDebugEnabled}
                      onCheckedChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          discordDebugEnabled: value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-medium">Tracker aktiv</p>
                      <p className="text-xs text-muted-foreground">
                        Deaktivierte Tracker sind im Alltag gesperrt.
                      </p>
                    </div>
                    <Switch
                      checked={trackerDraft.isActive}
                      onCheckedChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          isActive: value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateTrackerMutation.isPending}
                >
                  {updateTrackerMutation.isPending
                    ? "Speichert..."
                    : "Tracker speichern"}
                </Button>

                {!tracker.isActive ? (
                  <p className="text-sm text-muted-foreground">
                    Dieser Tracker ist archiviert. Falls die API nur eine
                    Reaktivierung zulaesst, wird der Rest beim Speichern
                    abgewiesen.
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Kategorien</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(item.id, item.name)}
                            disabled={deleteCategoryMutation.isPending || !tracker.isActive}
                          >
                            <Trash2 className="h-4 w-4" />
                            Loeschen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {categories.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Fuer diesen Tracker sind noch keine Kategorien vorhanden.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payees</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payees.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePayee(item.id, item.name)}
                            disabled={deletePayeeMutation.isPending || !tracker.isActive}
                          >
                            <Trash2 className="h-4 w-4" />
                            Loeschen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {payees.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Fuer diesen Tracker sind noch keine Payees vorhanden.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
