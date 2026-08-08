"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileStack, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { fetchJson } from "@/lib/client-fetch";
import { DEFAULT_TRACKER_COLOR } from "@/lib/tracker-defaults";
import { TrackerColorPicker } from "@/components/trackers/tracker-color-picker";

type CaseWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  isActive: boolean;
  permission: "owner" | "admin" | "write" | "read";
};

export function CaseWorkspaceListClient() {
  const t = useTranslations("Cases.workspaceList");
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_TRACKER_COLOR);

  // Lets the Ctrl+K command palette deep-link here with ?new=workspace, the
  // same way it deep-links into a workspace board with ?new=case. Adjusting
  // state during render (rather than in an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect.
  const newParam = searchParams.get("new");
  const [seenNewParam, setSeenNewParam] = useState(newParam);
  if (newParam !== seenNewParam) {
    setSeenNewParam(newParam);
    if (newParam === "workspace") {
      setSheetOpen(true);
    }
  }

  useEffect(() => {
    if (newParam === "workspace") {
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      event.preventDefault();
      setSheetOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });

  const workspaces = workspacesQuery.data?.items || [];

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description: string; color: string }) =>
      fetchJson<{ item: CaseWorkspace }>("/api/case-workspaces", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: CaseWorkspace[] } | undefined>(
        ["case-workspaces"],
        (current) => ({ items: [...(current?.items || []), item] })
      );
      toast.success(t("toast.created"));
      setSheetOpen(false);
      setName("");
      setDescription("");
      setColor(DEFAULT_TRACKER_COLOR);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.createFailed"));
    },
  });

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error(t("toast.nameRequired"));
      return;
    }
    createMutation.mutate({ name: name.trim(), description: description.trim(), color });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" shape="pill" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("createCta")}
        </Button>
      </div>

      {!workspacesQuery.isLoading && workspaces.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("createCta")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-1.5">
          {workspaces.map((workspace) => (
            <Link key={workspace.id} href={`/cases/${workspace.id}`}>
              <ListRow
                leading={<EntityIcon color={workspace.color} label={workspace.name} />}
                title={workspace.name}
                subtitle={workspace.description || undefined}
              />
            </Link>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("sheet.title")}</SheetTitle>
            <SheetDescription>{t("sheet.description")}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">{t("sheet.name")}</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-description">{t("sheet.description2")}</Label>
              <Textarea
                id="workspace-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-color">{t("sheet.color")}</Label>
              <TrackerColorPicker id="workspace-color" value={color} onChange={setColor} />
            </div>
            <SheetFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t("sheet.creating") : t("sheet.create")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
