"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, RotateCcw, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";
import { fetchJson } from "@/lib/client-fetch";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";

type CaseWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  isActive: boolean;
  permission: "owner" | "admin" | "write" | "read";
};

type CaseWorkspaceMember = {
  id: string;
  userId: string;
  permission: "owner" | "admin" | "write" | "read";
  userName: string;
  userEmail: string;
};

type CaseWorkspaceMemberCandidate = {
  id: string;
  name: string;
  email: string;
};

export function CaseWorkspaceSettingsClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("Cases.settingsPage");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = useState("");
  const [newMemberPermission, setNewMemberPermission] = useState<"admin" | "write" | "read">(
    "write"
  );
  const [draft, setDraft] = useState<{
    name?: string;
    description?: string;
    color?: string;
  }>({});

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);

  const membersQuery = useQuery({
    queryKey: ["case-workspace-members", workspaceId],
    queryFn: () =>
      fetchJson<{ items: CaseWorkspaceMember[] }>(`/api/case-workspaces/${workspaceId}/members`),
  });

  const candidateSearch = memberSearch.trim();
  const candidatesQuery = useQuery({
    queryKey: ["case-workspace-member-candidates", workspaceId, candidateSearch],
    queryFn: () =>
      fetchJson<{ items: CaseWorkspaceMemberCandidate[] }>(
        `/api/case-workspaces/${workspaceId}/members/candidates?q=${encodeURIComponent(candidateSearch)}`
      ),
    enabled: candidateSearch.length >= 3,
  });

  const workspaceDraft = {
    name: draft.name ?? workspace?.name ?? "",
    description: draft.description ?? workspace?.description ?? "",
    color: draft.color ?? workspace?.color ?? DEFAULT_TRACKER_COLOR,
  };

  const updateWorkspaceMutation = useMutation({
    mutationFn: (payload: { name: string; description: string; color: string }) =>
      fetchJson<{ item: CaseWorkspace }>(`/api/case-workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: CaseWorkspace[] } | undefined>(
        ["case-workspaces"],
        (current) => ({
          items: (current?.items || []).map((entry) =>
            entry.id === item.id ? { ...entry, ...item } : entry
          ),
        })
      );
      setDraft({});
      toast.success(t("toast.saved"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.saveFailed"));
    },
  });

  const archiveWorkspaceMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      fetchJson<{ item: CaseWorkspace }>(`/api/case-workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: CaseWorkspace[] } | undefined>(
        ["case-workspaces"],
        (current) => ({
          items: (current?.items || []).map((entry) =>
            entry.id === item.id ? { ...entry, ...item } : entry
          ),
        })
      );
      toast.success(
        item.isActive ? t("dangerZone.reactivateSuccess") : t("dangerZone.archiveSuccess")
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.saveFailed"));
    },
  });

  const hideWorkspaceMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ item: CaseWorkspace }>(`/api/case-workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ isHidden: true }),
      }),
    onSuccess: () => {
      queryClient.setQueryData<{ items: CaseWorkspace[] } | undefined>(
        ["case-workspaces"],
        (current) => ({
          items: (current?.items || []).filter((entry) => entry.id !== workspaceId),
        })
      );
      toast.success(t("dangerZone.deleteSuccess"));
      router.push("/cases");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("dangerZone.deleteFailed"));
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (payload: { userId: string; permission: "admin" | "write" | "read" }) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success(t("toast.memberAdded"));
      setMemberSearch("");
      queryClient.invalidateQueries({ queryKey: ["case-workspace-members", workspaceId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.memberAddFailed"));
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
      fetchJson(`/api/case-workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ permission }),
      }),
    onSuccess: () => {
      toast.success(t("toast.memberUpdated"));
      queryClient.invalidateQueries({ queryKey: ["case-workspace-members", workspaceId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.memberUpdateFailed"));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(t("toast.memberRemoved"));
      queryClient.invalidateQueries({ queryKey: ["case-workspace-members", workspaceId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.memberRemoveFailed"));
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceDraft.name.trim()) {
      toast.error(t("toast.nameRequired"));
      return;
    }
    updateWorkspaceMutation.mutate({
      name: workspaceDraft.name.trim(),
      description: workspaceDraft.description.trim(),
      color: workspaceDraft.color,
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title={t("form.sectionTitle")}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ws-name">{t("form.name")}</Label>
                <Input
                  id="ws-name"
                  value={workspaceDraft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-description">{t("form.description")}</Label>
                <Textarea
                  id="ws-description"
                  value={workspaceDraft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-color">{t("form.color")}</Label>
                <TrackerColorPicker
                  id="ws-color"
                  value={workspaceDraft.color}
                  onChange={(value) => setDraft((current) => ({ ...current, color: value }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateWorkspaceMutation.isPending}>
                {updateWorkspaceMutation.isPending ? t("form.saving") : t("form.save")}
              </Button>
            </form>
          </SectionCard>

          {workspace && workspace.permission === "owner" ? (
            <SectionCard title={t("dangerZone.title")}>
              <div className="space-y-3">
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={archiveWorkspaceMutation.isPending}
                    onClick={() => archiveWorkspaceMutation.mutate(!workspace.isActive)}
                  >
                    {workspace.isActive ? (
                      <Archive className="h-4 w-4" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {workspace.isActive
                      ? archiveWorkspaceMutation.isPending
                        ? t("dangerZone.archiving")
                        : t("dangerZone.archive")
                      : archiveWorkspaceMutation.isPending
                        ? t("dangerZone.reactivating")
                        : t("dangerZone.reactivate")}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("dangerZone.archiveNote")}
                  </p>
                </div>

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={hideWorkspaceMutation.isPending}
                    onClick={() => {
                      if (window.confirm(t("confirm.deleteWorkspace", { name: workspace.name }))) {
                        hideWorkspaceMutation.mutate();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {hideWorkspaceMutation.isPending
                      ? t("dangerZone.deleting")
                      : t("dangerZone.delete")}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">{t("dangerZone.note")}</p>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>

        <SectionCard title={t("members.title")}>
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border bg-surface-muted p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <Input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder={t("members.searchPlaceholder")}
                />
                <Select
                  value={newMemberPermission}
                  onValueChange={(value) =>
                    setNewMemberPermission(value as "admin" | "write" | "read")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">{t("members.permissionRead")}</SelectItem>
                    <SelectItem value="write">{t("members.permissionWrite")}</SelectItem>
                    <SelectItem value="admin">{t("members.permissionAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {candidateSearch.length >= 3 ? (
                <div className="space-y-1.5">
                  {(candidatesQuery.data?.items || []).map((candidate) => (
                    <ListRow
                      key={candidate.id}
                      leading={<EntityIcon icon={UserRound} size="sm" />}
                      title={candidate.name}
                      subtitle={candidate.email}
                      trailing={
                        <Button
                          type="button"
                          size="sm"
                          shape="pill"
                          disabled={addMemberMutation.isPending}
                          onClick={() =>
                            addMemberMutation.mutate({
                              userId: candidate.id,
                              permission: newMemberPermission,
                            })
                          }
                        >
                          {t("members.add")}
                        </Button>
                      }
                    />
                  ))}
                  {(candidatesQuery.data?.items || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("members.noResults")}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("members.searchHint")}</p>
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
                      <Badge variant="outline">{t("members.owner")}</Badge>
                    ) : (
                      <Select
                        value={member.permission}
                        onValueChange={(value) =>
                          updateMemberMutation.mutate({
                            memberId: member.id,
                            permission: value as "admin" | "write" | "read",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">{t("members.permissionRead")}</SelectItem>
                          <SelectItem value="write">{t("members.permissionWrite")}</SelectItem>
                          <SelectItem value="admin">{t("members.permissionAdmin")}</SelectItem>
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
                        title={t("members.remove")}
                        className="text-expense hover:bg-expense-muted hover:text-expense"
                        disabled={removeMemberMutation.isPending}
                        onClick={() => {
                          if (window.confirm(t("confirm.removeMember", { email: member.userEmail }))) {
                            removeMemberMutation.mutate(member.id);
                          }
                        }}
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
      </div>
    </div>
  );
}
