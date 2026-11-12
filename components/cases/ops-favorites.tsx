"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchJson } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";

type Favorite = { id: string; opsCode: string; description: string; isHybrid: boolean };
type FavoriteDraft = Omit<Favorite, "id">;

const EMPTY: FavoriteDraft = { opsCode: "", description: "", isHybrid: false };

function FavoriteDialog({
  entry,
  onClose,
}: {
  entry: Favorite | "new";
  onClose: () => void;
}) {
  const t = useTranslations("Cases.ops.favorites");
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<FavoriteDraft>(
    entry === "new"
      ? EMPTY
      : { opsCode: entry.opsCode, description: entry.description, isHybrid: entry.isHybrid }
  );
  const valid = draft.opsCode.trim() !== "" && draft.description.trim() !== "";

  const save = useMutation({
    mutationFn: () =>
      entry === "new"
        ? fetchJson("/api/ops/favorites", { method: "POST", body: JSON.stringify(draft) })
        : fetchJson(`/api/ops/favorites/${entry.id}`, { method: "PUT", body: JSON.stringify(draft) }),
    onSuccess: async () => {
      toast.success(t(entry === "new" ? "added" : "saved"));
      await queryClient.invalidateQueries({ queryKey: ["ops-favorites"] });
      onClose();
    },
    onError: () => toast.error(t("saveFailed")),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(entry === "new" ? "addTitle" : "editTitle")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="fav-code">{t("code")}</Label>
            <Input
              id="fav-code"
              value={draft.opsCode}
              maxLength={20}
              onChange={(e) => setDraft({ ...draft, opsCode: e.target.value })}
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fav-description">{t("description")}</Label>
            <Input
              id="fav-description"
              value={draft.description}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fav-hybrid"
              checked={draft.isHybrid}
              onCheckedChange={(v) => setDraft({ ...draft, isHybrid: v === true })}
            />
            <Label htmlFor="fav-hybrid" className="font-normal">
              {t("hybrid")}
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OpsFavorites({
  isAdmin,
  onPick,
}: {
  isAdmin: boolean;
  onPick: (code: string) => void;
}) {
  const t = useTranslations("Cases.ops.favorites");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Favorite | "new" | null>(null);
  const [deleting, setDeleting] = useState<Favorite | null>(null);

  const { data } = useQuery({
    queryKey: ["ops-favorites"],
    queryFn: () => fetchJson<{ items: Favorite[] }>("/api/ops/favorites"),
  });
  const items = data?.items ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/ops/favorites/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success(t("deleted"));
      await queryClient.invalidateQueries({ queryKey: ["ops-favorites"] });
    },
    onError: () => toast.error(t("deleteFailed")),
  });

  return (
    <SectionCard
      title={t("title")}
      titleRight={
        isAdmin ? (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-1 rounded-lg border",
                item.isHybrid ? "border-emerald-500/30 bg-emerald-500/10" : "bg-card"
              )}
            >
              <button
                type="button"
                onClick={() => onPick(item.opsCode)}
                aria-label={t("pickAria", { code: item.opsCode })}
                className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 text-left hover:bg-muted/60"
              >
                <span className="font-mono text-sm font-semibold">{item.opsCode}</span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">{item.description}</span>
                {item.isHybrid ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {t("hybridBadge")}
                  </span>
                ) : null}
              </button>
              {isAdmin ? (
                <span className="flex shrink-0 pr-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("editAria", { code: item.opsCode })}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("deleteAria", { code: item.opsCode })}
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <FavoriteDialog key={editing === "new" ? "new" : editing.id} entry={editing} onClose={() => setEditing(null)} />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { code: deleting?.opsCode ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
