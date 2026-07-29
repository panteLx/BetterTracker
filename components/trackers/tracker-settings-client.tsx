"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Copy,
  Globe,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";
import { TrackerPillRow } from "@/components/trackers/tracker-pill-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { SectionCard } from "@/components/ui/section-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CsvImportDialog } from "@/components/trackers/csv-import-dialog";
import { fetchJson } from "@/lib/client-fetch";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";
import { cn, sortByName } from "@/lib/utils";

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
  isPublic?: boolean;
  slug?: string;
  permission?: "owner" | "admin" | "write" | "read";
};

type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  isActive: boolean;
};

type Payee = {
  id: string;
  name: string;
  isActive: boolean;
};

type TrackerMember = {
  id: string;
  userId: string;
  permission: "owner" | "admin" | "write" | "read";
  userName: string;
  userEmail: string;
  userRole: "user" | "admin" | "superadmin";
};

type TrackerMemberCandidate = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "superadmin";
};

type TrackerSettingsClientProps = {
  initialTrackerId: string;
  locale: string;
};

function sortTrackers(items: Tracker[], locale: string) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, locale),
  );
}

const CATEGORY_TYPE_LABELS = {
  expense: "Ausgabe",
  income: "Einnahme",
  transfer: "Umbuchung",
} as const;

export function TrackerSettingsClient({
  initialTrackerId,
  locale,
}: TrackerSettingsClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedTracker, setSelectedTracker] = useState(initialTrackerId);
  const [importOpen, setImportOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [newMemberPermission, setNewMemberPermission] = useState<
    "admin" | "write" | "read"
  >("write");
  const [draft, setDraft] = useState<{
    name?: string;
    color?: string;
    currency?: string;
    description?: string;
    discordWebhookUrl?: string;
    discordPingRoleId?: string;
    discordDebugEnabled?: boolean;
    isActive?: boolean;
    isPublic?: boolean;
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

  const membersQuery = useQuery({
    queryKey: ["tracker-members", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: TrackerMember[] }>(
        `/api/trackers/${activeTrackerId}/members`,
      ),
    enabled: Boolean(activeTrackerId),
  });

  const candidateSearch = memberSearch.trim();
  const candidatesQuery = useQuery({
    queryKey: ["tracker-member-candidates", activeTrackerId, candidateSearch],
    queryFn: () =>
      fetchJson<{ items: TrackerMemberCandidate[] }>(
        `/api/trackers/${activeTrackerId}/members/candidates?q=${encodeURIComponent(
          candidateSearch,
        )}`,
      ),
    enabled: Boolean(activeTrackerId && candidateSearch.length >= 2),
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
    isPublic: draft.isPublic ?? tracker?.isPublic ?? false,
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
      isPublic: boolean;
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
          isPublic: payload.isPublic,
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

  const hideTrackerMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ item: Tracker }>(`/api/trackers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isHidden: true }),
      }),
    onSuccess: () => {
      queryClient.setQueryData<{ items: Tracker[] } | undefined>(
        ["trackers"],
        (current) => ({
          items: (current?.items || []).filter(
            (entry) => entry.id !== activeTrackerId,
          ),
        }),
      );
      toast.success("Tracker ausgeblendet");
      router.push("/");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Tracker konnte nicht ausgeblendet werden",
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
      toast.success("Kategorie gelöscht");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kategorie konnte nicht gelöscht werden",
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
      toast.success("Einzahler gelöscht");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Einzahler konnte nicht gelöscht werden",
      );
    },
  });

  const archiveCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchJson<{ item: Category }>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Category[] } | undefined>(
        ["categories", activeTrackerId],
        (current) => ({
          items: (current?.items || []).map((entry) =>
            entry.id === item.id ? { ...entry, ...item } : entry,
          ),
        }),
      );
      toast.success(item.isActive ? "Kategorie reaktiviert" : "Kategorie archiviert");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Aktion fehlgeschlagen",
      );
    },
  });

  const archivePayeeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchJson<{ item: Payee }>(`/api/payees/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Payee[] } | undefined>(
        ["payees", activeTrackerId],
        (current) => ({
          items: (current?.items || []).map((entry) =>
            entry.id === item.id ? { ...entry, ...item } : entry,
          ),
        }),
      );
      toast.success(item.isActive ? "Einzahler reaktiviert" : "Einzahler archiviert");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Aktion fehlgeschlagen",
      );
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (payload: {
      userId: string;
      permission: "admin" | "write" | "read";
    }) =>
      fetchJson(`/api/trackers/${activeTrackerId}/members`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Freigabe hinzugefügt");
      setMemberSearch("");
      queryClient.invalidateQueries({
        queryKey: ["tracker-members", activeTrackerId],
      });
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Freigabe konnte nicht erstellt werden",
      );
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({
      memberId,
      permission,
    }: {
      memberId: string;
      permission: "admin" | "write" | "read";
    }) =>
      fetchJson(`/api/trackers/${activeTrackerId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ permission }),
      }),
    onSuccess: () => {
      toast.success("Freigabe aktualisiert");
      queryClient.invalidateQueries({
        queryKey: ["tracker-members", activeTrackerId],
      });
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Freigabe konnte nicht aktualisiert werden",
      );
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      fetchJson(`/api/trackers/${activeTrackerId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Freigabe entfernt");
      queryClient.invalidateQueries({
        queryKey: ["tracker-members", activeTrackerId],
      });
      queryClient.invalidateQueries({ queryKey: ["trackers"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Freigabe konnte nicht entfernt werden",
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
      isPublic: trackerDraft.isPublic,
    });
  }

  function handleDeleteCategory(id: string, name: string) {
    if (!window.confirm(`Kategorie "${name}" wirklich löschen?`)) {
      return;
    }

    deleteCategoryMutation.mutate(id);
  }

  function handleDeletePayee(id: string, name: string) {
    if (!window.confirm(`Einzahler "${name}" wirklich löschen?`)) {
      return;
    }

    deletePayeeMutation.mutate(id);
  }

  function handleAddMember(userId: string) {
    addMemberMutation.mutate({
      userId,
      permission: newMemberPermission,
    });
  }

  function handleRemoveMember(memberId: string, label: string) {
    if (!window.confirm(`Freigabe für "${label}" wirklich entfernen?`)) {
      return;
    }

    removeMemberMutation.mutate(memberId);
  }

  if (!trackersQuery.isLoading && !tracker) {
    return (
      <EmptyState
        icon={Settings2}
        title="Kein Tracker verfügbar"
        description="Lege zuerst einen Tracker an, bevor du die Settings verwaltest."
        action={
          <Button asChild variant="outline">
            <Link href="/">Zurück zu den Buchungen</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Tracker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <TrackerPillRow
          trackers={trackers}
          activeTrackerId={activeTrackerId}
          onSelect={handleTrackerChange}
        />
        <Button asChild variant="ghost" size="sm" shape="pill" className="ml-auto">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
        </Button>
      </div>

      {tracker ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          {/* Left: tracker form */}
          <div className="space-y-4">
          <SectionCard title="Tracker-Einstellungen">
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
                  rows={3}
                  placeholder="Optionaler Kontext für diesen Tracker"
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
                <Label htmlFor="tracker-currency">Währung</Label>
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div>
                    <p className="text-sm font-medium">Discord Debug</p>
                    <p className="text-xs text-muted-foreground">
                      Zusatzinfos mitsenden.
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

                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div>
                    <p className="text-sm font-medium">Tracker archivieren</p>
                    <p className="text-xs text-muted-foreground">
                      Es können keine neuen Buchungen angelegt werden.
                    </p>
                  </div>
                  <Switch
                    checked={!trackerDraft.isActive}
                    onCheckedChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        isActive: !value,
                      }))
                    }
                  />
                </div>
              </div>

              <PublicShareToggle
                isPublic={trackerDraft.isPublic}
                slug={tracker?.slug ?? ""}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, isPublic: value }))
                }
              />

              <Button
                type="submit"
                className="w-full"
                disabled={updateTrackerMutation.isPending}
              >
                {updateTrackerMutation.isPending
                  ? "Speichert..."
                  : "Tracker speichern"}
              </Button>
            </form>
          </SectionCard>

            {tracker.permission === "owner" ? (
              <SectionCard title="Gefahrenzone">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={hideTrackerMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Tracker "${tracker.name}" wirklich für löschen? Er kann nur von einem Administrator wiederhergestellt werden.`,
                      )
                    ) {
                      hideTrackerMutation.mutate(tracker.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {hideTrackerMutation.isPending
                    ? "Wird gelöscht…"
                    : "Tracker löschen"}
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Diese Aktion kann durch User nicht rückgängig gemacht werden.
                </p>
              </SectionCard>
            ) : null}
          </div>

          {/* Right: members, categories, payees */}
          <div className="min-w-0 space-y-4">
            {/* Members */}
            <SectionCard title="Freigaben">
              <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-border bg-surface-muted p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <Input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Name oder E-Mail suchen"
                  />
                  <Select
                    value={newMemberPermission}
                    onValueChange={(value) =>
                      setNewMemberPermission(
                        value as "admin" | "write" | "read",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="write">Write</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {candidateSearch.length >= 2 ? (
                  <div className="space-y-1.5">
                    {(candidatesQuery.data?.items || []).map((candidate) => (
                      <ListRow
                        key={candidate.id}
                        leading={<EntityIcon icon={UserRound} size="sm" />}
                        title={candidate.name}
                        subtitle={`${candidate.email} · ${candidate.role}`}
                        trailing={
                          <Button
                            type="button"
                            size="sm"
                            shape="pill"
                            onClick={() => handleAddMember(candidate.id)}
                            disabled={addMemberMutation.isPending}
                          >
                            Freigeben
                          </Button>
                        }
                      />
                    ))}
                    {(candidatesQuery.data?.items || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Keine passenden Benutzer gefunden.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Mindestens 2 Zeichen eingeben.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                {(membersQuery.data?.items || []).map((member) => (
                  <ListRow
                    key={member.id}
                    leading={<EntityIcon icon={UserRound} size="sm" />}
                    title={member.userName}
                    subtitle={member.userEmail}
                    trailing={
                      member.permission === "owner" ? (
                        <Badge variant="outline">Owner</Badge>
                      ) : (
                        <Select
                          value={member.permission}
                          onValueChange={(value) =>
                            updateMemberMutation.mutate({
                              memberId: member.id,
                              permission: value as
                                | "admin"
                                | "write"
                                | "read",
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read">Read</SelectItem>
                            <SelectItem value="write">Write</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )
                    }
                    actions={
                      member.permission !== "owner" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          shape="pill"
                          title="Entfernen"
                          aria-label={`Freigabe für ${member.userEmail} entfernen`}
                          className="text-expense hover:bg-expense-muted hover:text-expense"
                          disabled={removeMemberMutation.isPending}
                          onClick={() =>
                            handleRemoveMember(member.id, member.userEmail)
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null
                    }
                  />
                ))}
              </div>
              </div>
            </SectionCard>

            {/* CSV Import */}
            {(tracker.permission === "owner" || tracker.permission === "admin") && (
              <>
                <SectionCard
                  title="CSV-Import"
                  titleRight={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setImportOpen(true)}
                      disabled={!tracker.isActive}
                    >
                      <Upload className="h-4 w-4" />
                      Importieren
                    </Button>
                  }
                >
                  <p className="font-subtext text-sm text-muted-foreground">
                    Transaktionen aus Actual Budget importieren.
                  </p>
                </SectionCard>
                <CsvImportDialog
                  open={importOpen}
                  onOpenChange={setImportOpen}
                  trackerId={activeTrackerId}
                  onSuccess={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["categories", activeTrackerId],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["payees", activeTrackerId],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["transactions", activeTrackerId],
                    });
                  }}
                />
              </>
            )}

            {/* Categories */}
            <SectionCard title="Kategorien">
              {categories.length > 0 ? (
                <div className="space-y-1.5">
                  {categories.map((item) => {
                    const Icon =
                      item.type === "expense"
                        ? ArrowDownLeft
                        : item.type === "income"
                          ? ArrowUpRight
                          : ArrowLeftRight;

                    return (
                      <ListRow
                        key={item.id}
                        className={cn(!item.isActive && "opacity-60")}
                        leading={
                          <EntityIcon
                            icon={Icon}
                            size="sm"
                            className={
                              item.type === "expense"
                                ? "bg-expense-muted text-expense"
                                : item.type === "income"
                                  ? "bg-income-muted text-income"
                                  : "bg-info-muted text-info"
                            }
                          />
                        }
                        meta={
                          <>
                            <Badge
                              variant={
                                item.type === "expense"
                                  ? "expense"
                                  : item.type === "income"
                                    ? "income"
                                    : "secondary"
                              }
                            >
                              {CATEGORY_TYPE_LABELS[item.type]}
                            </Badge>
                            {!item.isActive ? (
                              <Badge variant="outline">Archiviert</Badge>
                            ) : null}
                          </>
                        }
                        title={
                          <span className={cn(!item.isActive && "line-through")}>
                            {item.name}
                          </span>
                        }
                        actions={
                          <>
                            {(tracker.permission === "owner" ||
                              tracker.permission === "admin") ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                shape="pill"
                                title={
                                  item.isActive ? "Archivieren" : "Reaktivieren"
                                }
                                aria-label={`Kategorie ${item.name} ${
                                  item.isActive ? "archivieren" : "reaktivieren"
                                }`}
                                disabled={archiveCategoryMutation.isPending}
                                onClick={() =>
                                  archiveCategoryMutation.mutate({
                                    id: item.id,
                                    isActive: !item.isActive,
                                  })
                                }
                              >
                                {item.isActive ? (
                                  <Archive className="h-4 w-4" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              shape="pill"
                              title="Löschen"
                              aria-label={`Kategorie ${item.name} löschen`}
                              className="text-expense hover:bg-expense-muted hover:text-expense"
                              disabled={
                                deleteCategoryMutation.isPending ||
                                !tracker.isActive
                              }
                              onClick={() =>
                                handleDeleteCategory(item.id, item.name)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch keine Kategorien vorhanden.
                </p>
              )}
            </SectionCard>

            {/* Payees */}
            <SectionCard title="Einzahler">
              {payees.length > 0 ? (
                <div className="space-y-1.5">
                  {payees.map((item) => (
                    <ListRow
                      key={item.id}
                      className={cn(!item.isActive && "opacity-60")}
                      leading={<EntityIcon icon={UserRound} size="sm" />}
                      meta={
                        !item.isActive ? (
                          <Badge variant="outline">Archiviert</Badge>
                        ) : undefined
                      }
                      title={
                        <span className={cn(!item.isActive && "line-through")}>
                          {item.name}
                        </span>
                      }
                      actions={
                        <>
                          {(tracker.permission === "owner" ||
                            tracker.permission === "admin") ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              shape="pill"
                              title={
                                item.isActive ? "Archivieren" : "Reaktivieren"
                              }
                              aria-label={`Einzahler ${item.name} ${
                                item.isActive ? "archivieren" : "reaktivieren"
                              }`}
                              disabled={archivePayeeMutation.isPending}
                              onClick={() =>
                                archivePayeeMutation.mutate({
                                  id: item.id,
                                  isActive: !item.isActive,
                                })
                              }
                            >
                              {item.isActive ? (
                                <Archive className="h-4 w-4" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            shape="pill"
                            title="Löschen"
                            aria-label={`Einzahler ${item.name} löschen`}
                            className="text-expense hover:bg-expense-muted hover:text-expense"
                            disabled={
                              deletePayeeMutation.isPending || !tracker.isActive
                            }
                            onClick={() => handleDeletePayee(item.id, item.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch keine Einzahler vorhanden.
                </p>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PublicShareToggle({
  isPublic,
  slug,
  onChange,
}: {
  isPublic: boolean;
  slug: string;
  onChange: (value: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/t/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Öffentlich freigeben</p>
            <p className="text-xs text-muted-foreground">
              Lesezugriff für Gäste ohne Anmeldung.
            </p>
          </div>
        </div>
        <Switch checked={isPublic} onCheckedChange={onChange} />
      </div>

      {isPublic && slug ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {typeof window !== "undefined"
              ? `${window.location.origin}/t/${slug}`
              : `/t/${slug}`}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 rounded-md p-1 hover:bg-muted"
            aria-label="Link kopieren"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-income" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
