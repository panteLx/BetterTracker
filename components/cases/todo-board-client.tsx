"use client";

import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  CalendarClock,
  Eye,
  EyeOff,
  Flame,
  GripVertical,
  ListChecks,
  MessageSquare,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { TodoItemDetailDialog } from "@/components/cases/todo-item-detail-dialog";
import { fetchJson } from "@/lib/client-fetch";
import { cn, formatDateShort } from "@/lib/utils";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";

export type TodoItem = {
  id: string;
  listId: string;
  body: string;
  isDone: boolean;
  dueDate: string | null;
  priority: "low" | "normal" | "high";
  position: number;
  assigneeUserId: string | null;
  assigneeName: string | null;
  commentCount: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssignableMember = {
  userId: string;
  name: string;
  email: string;
};

type TodoList = {
  id: string;
  workspaceId: string;
  name: string;
  isArchived: boolean;
  position: number;
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

type ItemDragState = { itemId: string; sourceListId: string; height: number } | null;
type ItemDropTarget = { listId: string; index: number } | null;
type ColumnDragState = { listId: string; height: number } | null;

/**
 * Drop index derived purely from the geometry of the *non-dragged* siblings:
 * the pointer goes before the first sibling whose midpoint it has not passed.
 *
 * The midpoint rule is what keeps the preview from flickering. "After sibling
 * i - 1" and "before sibling i" are the same index, so inserting the
 * placeholder — which pushes everything below it along — cannot flip the
 * result back and forth. Whole-element hit testing (hovering element i means
 * "insert before i") does not have that property and oscillates.
 */
function computeDropIndex(
  container: HTMLElement,
  selector: string,
  pointer: number,
  axis: "x" | "y"
) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));
  for (let index = 0; index < nodes.length; index++) {
    const rect = nodes[index].getBoundingClientRect();
    const middle = axis === "y" ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    if (pointer < middle) return index;
  }
  return nodes.length;
}

function isOverdue(item: TodoItem) {
  if (!item.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${item.dueDate}T00:00:00`) < today;
}

function isDueToday(item: TodoItem) {
  if (!item.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${item.dueDate}T00:00:00`).getTime() === today.getTime();
}

function TodoCard({
  workspaceId,
  list,
  item,
  canEdit,
  members,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  workspaceId: string;
  list: TodoList;
  item: TodoItem;
  canEdit: boolean;
  members: AssignableMember[];
  isDragging: boolean;
  onDragStart: (height: number) => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations("Cases.todos");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId] });
  }

  const deleteItemMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${list.id}/items/${item.id}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.deleteItemFailed"));
    },
  });

  const overdue = isOverdue(item);
  const dueToday = !overdue && isDueToday(item);
  const hasMeta = item.dueDate || item.priority !== "normal" || item.assigneeName || item.commentCount > 0;

  return (
    <div
      // Only non-dragged cards are measurable drop anchors; the dragged card
      // keeps its slot (removing it mid-drag aborts the native drag session)
      // but must not influence the computed drop index.
      data-todo-card={isDragging ? undefined : ""}
      draggable={canEdit}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(event.currentTarget.getBoundingClientRect().height);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex flex-col gap-1 rounded-lg border border-transparent bg-card px-2 py-2 shadow-sm hover:border-border hover:bg-surface-muted",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {canEdit ? (
          <GripVertical
            className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100"
            aria-hidden
          />
        ) : null}
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          aria-label={t("openItemDetails", { body: item.body })}
          className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left text-sm [overflow-wrap:anywhere]"
        >
          {item.body}
        </button>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
            disabled={deleteItemMutation.isPending}
            onClick={() => deleteItemMutation.mutate()}
            aria-label={t("deleteItem")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {hasMeta ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {item.dueDate ? (
            <Badge
              variant={overdue ? "destructive" : dueToday ? "warning" : "info"}
              className="gap-1"
            >
              <CalendarClock className="h-3 w-3" />
              {overdue ? `${t("overdue")} · ` : ""}
              {formatDateShort(item.dueDate, locale)}
            </Badge>
          ) : null}
          {item.priority === "high" ? (
            <Badge variant="destructive" className="gap-1">
              <Flame className="h-3 w-3" />
              {t("priorityHigh")}
            </Badge>
          ) : null}
          {item.priority === "low" ? (
            <Badge variant="secondary" className="gap-1">
              <ArrowDown className="h-3 w-3" />
              {t("priorityLow")}
            </Badge>
          ) : null}
          {item.assigneeName ? (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <UserRound className="h-3 w-3" />
              {item.assigneeName}
            </Badge>
          ) : null}
          {item.commentCount > 0 ? (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {item.commentCount}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <TodoItemDetailDialog
        workspaceId={workspaceId}
        listId={list.id}
        item={item}
        members={members}
        canEdit={canEdit}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

type ItemRow = { kind: "item"; item: TodoItem } | { kind: "placeholder" };

function KanbanColumn({
  workspaceId,
  list,
  canEdit,
  members,
  itemDrag,
  itemDropTarget,
  onCardDragStart,
  onItemDragOver,
  onItemDragEnd,
  allowColumnReorder,
  isColumnDragging,
  onColumnDragStart,
  onColumnDragEnd,
}: {
  workspaceId: string;
  list: TodoList;
  canEdit: boolean;
  members: AssignableMember[];
  itemDrag: ItemDragState;
  itemDropTarget: ItemDropTarget;
  onCardDragStart: (itemId: string, sourceListId: string, height: number) => void;
  onItemDragOver: (listId: string, index: number) => void;
  onItemDragEnd: () => void;
  allowColumnReorder: boolean;
  isColumnDragging: boolean;
  onColumnDragStart: (listId: string, height: number) => void;
  onColumnDragEnd: () => void;
}) {
  const t = useTranslations("Cases.todos");
  const queryClient = useQueryClient();
  const archived = list.isArchived;
  const columnRootRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
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
  const showColumnGrip = allowColumnReorder && canEdit && !archived;

  // The dragged card's own DOM node must stay mounted for the whole drag —
  // removing it mid-drag aborts the native HTML5 drag session. So every item
  // (including the one being dragged) is always rendered; a separate
  // placeholder row is inserted at the computed drop index instead.
  const draggedItemId = itemDrag && itemDrag.sourceListId === list.id ? itemDrag.itemId : null;
  let otherCount = 0;
  const enrichedItems = list.items.map((item) => {
    const isDragged = item.id === draggedItemId;
    const index = otherCount;
    if (!isDragged) otherCount++;
    return { item, isDragged, index };
  });

  const showPlaceholder = canEditItems && itemDropTarget !== null && itemDropTarget.listId === list.id;
  const insertAt = showPlaceholder ? Math.max(0, Math.min(itemDropTarget!.index, otherCount)) : -1;

  const itemRows: ItemRow[] = [];
  let placeholderInserted = false;
  for (const entry of enrichedItems) {
    if (showPlaceholder && !placeholderInserted && !entry.isDragged && entry.index === insertAt) {
      itemRows.push({ kind: "placeholder" });
      placeholderInserted = true;
    }
    itemRows.push({ kind: "item", item: entry.item });
  }
  if (showPlaceholder && !placeholderInserted) {
    itemRows.push({ kind: "placeholder" });
  }

  return (
    <div
      ref={columnRootRef}
      // Only non-dragged columns anchor the column drop index — same reason as
      // for cards above.
      data-todo-column={isColumnDragging ? undefined : ""}
      className={cn(
        "flex max-h-[70vh] w-[300px] shrink-0 flex-col rounded-xl border border-border bg-card",
        archived && "opacity-75",
        isColumnDragging && "opacity-40"
      )}
      // Accepting the drop anywhere in the column — header, card area, footer,
      // gaps — instead of only on the cards themselves: a release over a gap
      // used to end the drag without ever firing "drop".
      onDragOver={(event) => {
        if (!itemDrag || !canEditItems) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const container = itemsRef.current;
        if (!container) return;
        onItemDragOver(list.id, computeDropIndex(container, "[data-todo-card]", event.clientY, "y"));
      }}
    >
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {showColumnGrip ? (
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", list.id);
              event.dataTransfer.effectAllowed = "move";
              const root = columnRootRef.current;
              if (root) {
                event.dataTransfer.setDragImage(root, 24, 16);
              }
              onColumnDragStart(list.id, root?.getBoundingClientRect().height ?? 44);
            }}
            onDragEnd={onColumnDragEnd}
            aria-label={t("dragHandleAria")}
            className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
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
        <Badge variant="outline" className="shrink-0">
          {list.items.length}
        </Badge>
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

      <div ref={itemsRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {list.items.length === 0 ? (
          // A single node that stays mounted the whole time, whether or not a
          // card is being dragged over it: swapping this element out for a
          // different one (e.g. an empty-state text vs. a placeholder box)
          // while it is the live drag target makes Chromium cancel the drag
          // instead of firing "drop", since the hovered node was removed.
          <div
            style={showPlaceholder ? { minHeight: itemDrag?.height } : undefined}
            className={cn(
              "rounded-lg px-1.5 py-2 text-xs",
              showPlaceholder
                ? "border-2 border-dashed border-primary/60 bg-primary/5 text-transparent"
                : "text-muted-foreground"
            )}
          >
            {t("emptyItems")}
          </div>
        ) : (
          itemRows.map((row) =>
            row.kind === "placeholder" ? (
              <div
                key="item-drop-placeholder"
                style={{ height: itemDrag?.height }}
                className="shrink-0 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5"
              />
            ) : (
              <TodoCard
                key={row.item.id}
                workspaceId={workspaceId}
                list={list}
                item={row.item}
                canEdit={canEditItems}
                members={members}
                isDragging={itemDrag?.itemId === row.item.id}
                onDragStart={(height) => onCardDragStart(row.item.id, list.id, height)}
                onDragEnd={onItemDragEnd}
              />
            )
          )
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

function AddColumn({ onCreate, pending }: { onCreate: (name: string) => void; pending: boolean }) {
  const t = useTranslations("Cases.todos");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex h-11 w-[300px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground hover:border-ring hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        {t("newList")}
      </button>
    );
  }

  return (
    <form
      className="flex w-[300px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-card p-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onCreate(trimmed);
        setName("");
        setAdding(false);
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("newListPlaceholder")}
        aria-label={t("listNameAria")}
        className="h-9"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setAdding(false);
            setName("");
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          {t("newList")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAdding(false);
            setName("");
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

type ColumnRow = { kind: "column"; list: TodoList } | { kind: "placeholder" };

function KanbanBoard({
  workspaceId,
  lists,
  canEdit,
  members,
  onCreateColumn,
  createPending,
  showAddColumn = canEdit,
  allowColumnReorder = canEdit,
}: {
  workspaceId: string;
  lists: TodoList[];
  canEdit: boolean;
  members: AssignableMember[];
  onCreateColumn: (name: string) => void;
  createPending: boolean;
  showAddColumn?: boolean;
  allowColumnReorder?: boolean;
}) {
  const t = useTranslations("Cases.todos");
  const queryClient = useQueryClient();
  const [itemDrag, setItemDrag] = useState<ItemDragState>(null);
  const [itemDropTarget, setItemDropTarget] = useState<ItemDropTarget>(null);
  const [columnDrag, setColumnDrag] = useState<ColumnDragState>(null);
  const [columnDropIndex, setColumnDropIndex] = useState<number | null>(null);

  const listsKey = ["todo-lists", workspaceId];

  // Both reorder mutations write the new order into the cache right away, so
  // the card/column stays where it was dropped instead of snapping back until
  // the refetch lands.
  async function snapshotLists() {
    await queryClient.cancelQueries({ queryKey: listsKey });
    return queryClient.getQueryData<{ items: TodoList[] }>(listsKey);
  }

  function restoreLists(previous: { items: TodoList[] } | undefined) {
    if (previous) queryClient.setQueryData(listsKey, previous);
    queryClient.invalidateQueries({ queryKey: listsKey });
  }

  const moveItemMutation = useMutation({
    mutationFn: ({
      sourceListId,
      itemId,
      targetListId,
      position,
    }: {
      sourceListId: string;
      itemId: string;
      targetListId: string;
      position: number;
    }) =>
      fetchJson(
        `/api/case-workspaces/${workspaceId}/todo-lists/${sourceListId}/items/${itemId}/move`,
        {
          method: "POST",
          body: JSON.stringify({ targetListId, position }),
        }
      ),
    onMutate: async ({ sourceListId, itemId, targetListId, position }) => {
      const previous = await snapshotLists();
      const moved = previous?.items
        .find((list) => list.id === sourceListId)
        ?.items.find((item) => item.id === itemId);
      if (previous && moved) {
        const withPositions = (items: TodoItem[], listId: string) =>
          items.map((item, index) => ({ ...item, listId, position: index }));
        queryClient.setQueryData(listsKey, {
          ...previous,
          items: previous.items.map((list) => {
            const isSource = list.id === sourceListId;
            const isTarget = list.id === targetListId;
            if (!isSource && !isTarget) return list;
            const items = list.items.filter((item) => item.id !== itemId);
            if (isTarget) {
              items.splice(Math.max(0, Math.min(position, items.length)), 0, moved);
            }
            return { ...list, items: withPositions(items, list.id) };
          }),
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      toast.error(error instanceof Error ? error.message : t("toast.moveItemFailed"));
      restoreLists(context?.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  });

  const reorderListsMutation = useMutation({
    mutationFn: (listIds: string[]) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/reorder`, {
        method: "POST",
        body: JSON.stringify({ listIds }),
      }),
    onMutate: async (listIds) => {
      const previous = await snapshotLists();
      if (previous) {
        const byId = new Map(previous.items.map((list) => [list.id, list]));
        const reordered = listIds
          .map((id, position) => {
            const list = byId.get(id);
            return list ? { ...list, position } : null;
          })
          .filter((list): list is TodoList => list !== null);
        if (reordered.length === previous.items.length) {
          queryClient.setQueryData(listsKey, { ...previous, items: reordered });
        }
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      toast.error(error instanceof Error ? error.message : t("toast.reorderListsFailed"));
      restoreLists(context?.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  });

  function resetItemDrag() {
    setItemDrag(null);
    setItemDropTarget(null);
  }

  function resetColumnDrag() {
    setColumnDrag(null);
    setColumnDropIndex(null);
  }

  function handleBoardDragOver(event: DragEvent<HTMLDivElement>) {
    if (columnDrag) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const next = computeDropIndex(
        event.currentTarget,
        "[data-todo-column]",
        event.clientX,
        "x"
      );
      setColumnDropIndex((current) => (current === next ? current : next));
      return;
    }
    // Over the gaps between columns during a card drag: keep the last drop
    // target and stay a valid drop zone so releasing there still commits.
    if (itemDrag) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleBoardDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (itemDrag && itemDropTarget) {
      moveItemMutation.mutate({
        sourceListId: itemDrag.sourceListId,
        itemId: itemDrag.itemId,
        targetListId: itemDropTarget.listId,
        position: itemDropTarget.index,
      });
    } else if (columnDrag && columnDropIndex !== null) {
      const filtered = lists.filter((list) => list.id !== columnDrag.listId);
      const insertAt = Math.max(0, Math.min(columnDropIndex, filtered.length));
      const orderedIds = filtered.map((list) => list.id);
      orderedIds.splice(insertAt, 0, columnDrag.listId);
      reorderListsMutation.mutate(orderedIds);
    }
    resetItemDrag();
    resetColumnDrag();
  }

  // The dragged column's own DOM node (and its grip handle, the native drag
  // source) must stay mounted for the whole drag, so every column is always
  // rendered at its original spot; a placeholder is inserted separately.
  const draggedListId = columnDrag?.listId ?? null;
  let otherColumnCount = 0;
  const enrichedColumns = lists.map((list) => {
    const isDragged = list.id === draggedListId;
    const index = otherColumnCount;
    if (!isDragged) otherColumnCount++;
    return { list, isDragged, index };
  });

  const showColumnPlaceholder = draggedListId !== null && columnDropIndex !== null;
  const columnInsertAt = showColumnPlaceholder
    ? Math.max(0, Math.min(columnDropIndex!, otherColumnCount))
    : -1;

  const columnRows: ColumnRow[] = [];
  let columnPlaceholderInserted = false;
  for (const entry of enrichedColumns) {
    if (showColumnPlaceholder && !columnPlaceholderInserted && !entry.isDragged && entry.index === columnInsertAt) {
      columnRows.push({ kind: "placeholder" });
      columnPlaceholderInserted = true;
    }
    columnRows.push({ kind: "column", list: entry.list });
  }
  if (showColumnPlaceholder && !columnPlaceholderInserted) {
    columnRows.push({ kind: "placeholder" });
  }

  return (
    <div
      className="flex items-start gap-4 overflow-x-auto pb-2"
      onDragOver={handleBoardDragOver}
      onDrop={handleBoardDrop}
    >
      {columnRows.map((row) =>
        row.kind === "placeholder" ? (
          <div
            key="column-drop-placeholder"
            style={{ height: columnDrag?.height }}
            className="w-[300px] shrink-0 rounded-xl border-2 border-dashed border-primary/60 bg-primary/5"
          />
        ) : (
          <KanbanColumn
            key={row.list.id}
            workspaceId={workspaceId}
            list={row.list}
            canEdit={canEdit}
            members={members}
            itemDrag={itemDrag}
            itemDropTarget={itemDropTarget}
            onCardDragStart={(itemId, sourceListId, height) => {
              setItemDrag({ itemId, sourceListId, height });
              setItemDropTarget(null);
            }}
            onItemDragOver={(listId, index) => {
              setItemDropTarget((current) =>
                current && current.listId === listId && current.index === index
                  ? current
                  : { listId, index }
              );
            }}
            onItemDragEnd={resetItemDrag}
            allowColumnReorder={allowColumnReorder}
            isColumnDragging={columnDrag?.listId === row.list.id}
            onColumnDragStart={(listId, height) => {
              setColumnDrag({ listId, height });
              setColumnDropIndex(null);
            }}
            onColumnDragEnd={resetColumnDrag}
          />
        )
      )}
      {showAddColumn ? <AddColumn onCreate={onCreateColumn} pending={createPending} /> : null}
    </div>
  );
}

export function TodoBoardClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("Cases.todos");
  const queryClient = useQueryClient();
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

  const membersQuery = useQuery({
    queryKey: ["todo-assignable-members", workspaceId],
    queryFn: () =>
      fetchJson<{ items: AssignableMember[] }>(
        `/api/case-workspaces/${workspaceId}/todo-lists/assignable-members`
      ),
    enabled: canEdit,
  });

  const createListMutation = useMutation({
    mutationFn: (name: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.createListFailed"));
    },
  });

  const lists = listsQuery.data?.items || [];
  const archivedLists = archivedListsQuery.data?.items || [];
  const members = membersQuery.data?.items || [];

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
        </div>
      </div>

      {!listsQuery.isLoading && lists.length === 0 && !canEdit ? (
        <EmptyState icon={ListChecks} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <KanbanBoard
          workspaceId={workspaceId}
          lists={lists}
          canEdit={canEdit}
          members={members}
          onCreateColumn={(name) => createListMutation.mutate(name)}
          createPending={createListMutation.isPending}
        />
      )}

      {showArchived ? (
        <div className="space-y-2 border-t border-border pt-4">
          <h2 className="text-sm font-medium text-muted-foreground">{t("archivedSectionTitle")}</h2>
          {!archivedListsQuery.isLoading && archivedLists.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noArchived")}</p>
          ) : (
            <KanbanBoard
              workspaceId={workspaceId}
              lists={archivedLists}
              canEdit={canEdit}
              members={members}
              onCreateColumn={() => {}}
              createPending={false}
              showAddColumn={false}
              allowColumnReorder={false}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
