"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Eye, EyeOff, ListChecks, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";

type TodoItem = {
  id: string;
  listId: string;
  body: string;
  isDone: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TodoList = {
  id: string;
  workspaceId: string;
  name: string;
  isArchived: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  items: TodoItem[];
};

type CaseWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  permission: "owner" | "admin" | "write" | "read";
};

function TodoListCard({
  workspaceId,
  list,
  canEdit,
}: {
  workspaceId: string;
  list: TodoList;
  canEdit: boolean;
}) {
  const t = useTranslations("Cases.todos");
  const queryClient = useQueryClient();
  const archived = list.isArchived;
  const [name, setName] = useState(list.name);
  const [lastName, setLastName] = useState(list.name);
  if (list.name !== lastName) {
    setLastName(list.name);
    setName(list.name);
  }
  const [newItemBody, setNewItemBody] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId] });
  }

  const renameMutation = useMutation({
    mutationFn: (nextName: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${list.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      }),
    onSuccess: invalidate,
    onError: (error) => {
      setName(list.name);
      toast.error(error instanceof Error ? error.message : t("toast.renameListFailed"));
    },
  });

  const setArchivedMutation = useMutation({
    mutationFn: (isArchived: boolean) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${list.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId, "archived"] });
    },
    onError: (_error, isArchived) => {
      toast.error(isArchived ? t("toast.archiveListFailed") : t("toast.unarchiveListFailed"));
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${list.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId, "archived"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.deleteListFailed"));
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (body: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${list.id}/items`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      invalidate();
      setNewItemBody("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.addItemFailed"));
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: ({ itemId, isDone }: { itemId: string; isDone: boolean }) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${list.id}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ isDone }),
      }),
    onSuccess: invalidate,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.updateItemFailed"));
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${list.id}/items/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.deleteItemFailed"));
    },
  });

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(list.name);
      return;
    }
    if (trimmed !== list.name) {
      renameMutation.mutate(trimmed);
    }
  }

  const canEditItems = canEdit && !archived;

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card", archived && "opacity-75")}>
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {canEdit && !archived ? (
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            aria-label={t("listNameAria")}
            className="h-8 flex-1 border-transparent bg-transparent px-1.5 font-medium shadow-none focus-visible:border-ring focus-visible:bg-field"
          />
        ) : (
          <span className="flex-1 truncate px-1.5 py-1 text-sm font-medium">{list.name}</span>
        )}
        {canEdit ? (
          <>
            {archived ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                disabled={setArchivedMutation.isPending}
                onClick={() => setArchivedMutation.mutate(false)}
                aria-label={t("unarchiveList")}
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                disabled={setArchivedMutation.isPending}
                onClick={() => {
                  if (window.confirm(t("confirmArchiveList"))) {
                    setArchivedMutation.mutate(true);
                  }
                }}
                aria-label={t("archiveList")}
              >
                <Archive className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={deleteListMutation.isPending}
              onClick={() => {
                if (window.confirm(t("confirmDeleteList"))) {
                  deleteListMutation.mutate();
                }
              }}
              aria-label={t("deleteList")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>

      <div className="flex-1 space-y-0.5 p-2">
        {list.items.length === 0 ? (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">{t("emptyItems")}</p>
        ) : (
          list.items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface-muted"
            >
              <Checkbox
                checked={item.isDone}
                disabled={!canEditItems || toggleItemMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleItemMutation.mutate({ itemId: item.id, isDone: checked === true })
                }
                aria-label={t("toggleItemAria", { body: item.body })}
              />
              <span
                className={cn(
                  "flex-1 break-words text-sm",
                  item.isDone && "text-muted-foreground line-through",
                )}
              >
                {item.body}
              </span>
              {canEditItems ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  disabled={deleteItemMutation.isPending}
                  onClick={() => deleteItemMutation.mutate(item.id)}
                  aria-label={t("deleteItem")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {canEditItems ? (
        <form
          className="flex items-center gap-2 border-t border-border p-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = newItemBody.trim();
            if (!trimmed) return;
            addItemMutation.mutate(trimmed);
          }}
        >
          <Input
            value={newItemBody}
            onChange={(event) => setNewItemBody(event.target.value)}
            placeholder={t("addItemPlaceholder")}
            className="h-8 flex-1"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={addItemMutation.isPending || !newItemBody.trim()}
            aria-label={t("addItem")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function TodoListGrid({
  workspaceId,
  lists,
  canEdit,
}: {
  workspaceId: string;
  lists: TodoList[];
  canEdit: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {lists.map((list) => (
        <TodoListCard key={list.id} workspaceId={workspaceId} list={list} canEdit={canEdit} />
      ))}
    </div>
  );
}

export function TodoBoardClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("Cases.todos");
  const queryClient = useQueryClient();
  const [newListName, setNewListName] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canEdit = workspace ? canWriteWorkspace(workspace.permission) : false;

  const listsQuery = useQuery({
    queryKey: ["todo-lists", workspaceId],
    queryFn: () => fetchJson<{ items: TodoList[] }>(`/api/case-workspaces/${workspaceId}/todo-lists`),
  });

  const archivedListsQuery = useQuery({
    queryKey: ["todo-lists", workspaceId, "archived"],
    queryFn: () =>
      fetchJson<{ items: TodoList[] }>(`/api/case-workspaces/${workspaceId}/todo-lists?archived=true`),
    enabled: canEdit && showArchived,
  });

  const createListMutation = useMutation({
    mutationFn: (name: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId] });
      setNewListName("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.createListFailed"));
    },
  });

  const lists = listsQuery.data?.items || [];
  const archivedLists = archivedListsQuery.data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowArchived((current) => !current)}
            >
              {showArchived ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showArchived ? t("hideArchivedToggle") : t("showArchivedToggle")}
            </Button>
          ) : null}
          {canEdit ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = newListName.trim();
                if (!trimmed) return;
                createListMutation.mutate(trimmed);
              }}
            >
              <Input
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder={t("newListPlaceholder")}
                className="h-9 w-56"
              />
              <Button type="submit" disabled={createListMutation.isPending || !newListName.trim()}>
                <Plus className="h-4 w-4" />
                {t("newList")}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {!listsQuery.isLoading && lists.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <TodoListGrid workspaceId={workspaceId} lists={lists} canEdit={canEdit} />
      )}

      {showArchived ? (
        <div className="space-y-2 border-t border-border pt-4">
          <h2 className="text-sm font-medium text-muted-foreground">{t("archivedSectionTitle")}</h2>
          {!archivedListsQuery.isLoading && archivedLists.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noArchived")}</p>
          ) : (
            <TodoListGrid workspaceId={workspaceId} lists={archivedLists} canEdit={canEdit} />
          )}
        </div>
      ) : null}
    </div>
  );
}
