"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchJson } from "@/lib/client-fetch";
import { formatDateTime } from "@/lib/utils";
import type { AssignableMember, TodoItem } from "@/components/cases/todo-board-client";

type TodoComment = {
  id: string;
  itemId: string;
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
};

const UNASSIGNED = "__unassigned__";

export function TodoItemDetailDialog({
  workspaceId,
  listId,
  item,
  members,
  canEdit,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  listId: string;
  item: TodoItem;
  members: AssignableMember[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Cases.todos");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [bodyDraft, setBodyDraft] = useState(item.body);
  const [lastItemBody, setLastItemBody] = useState(item.body);
  if (item.body !== lastItemBody) {
    setLastItemBody(item.body);
    setBodyDraft(item.body);
  }

  function invalidateItems() {
    queryClient.invalidateQueries({ queryKey: ["todo-lists", workspaceId] });
  }

  const updateItemMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${listId}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidateItems,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.updateItemFailed"));
    },
  });

  const updateBodyMutation = useMutation({
    mutationFn: (body: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/todo-lists/${listId}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      }),
    onSuccess: invalidateItems,
    onError: (error) => {
      setBodyDraft(item.body);
      toast.error(error instanceof Error ? error.message : t("toast.updateItemFailed"));
    },
  });

  function commitBody() {
    const trimmed = bodyDraft.trim();
    if (!trimmed) {
      setBodyDraft(item.body);
      return;
    }
    if (trimmed !== item.body) {
      updateBodyMutation.mutate(trimmed);
    }
  }

  const commentsQuery = useQuery({
    queryKey: ["todo-comments", item.id],
    queryFn: () =>
      fetchJson<{ items: TodoComment[] }>(
        `/api/case-workspaces/${workspaceId}/todo-lists/${listId}/items/${item.id}/comments`
      ),
    enabled: open,
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) =>
      fetchJson(
        `/api/case-workspaces/${workspaceId}/todo-lists/${listId}/items/${item.id}/comments`,
        { method: "POST", body: JSON.stringify({ body }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo-comments", item.id] });
      invalidateItems();
      setCommentBody("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.addCommentFailed"));
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      fetchJson(
        `/api/case-workspaces/${workspaceId}/todo-lists/${listId}/items/${item.id}/comments/${commentId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo-comments", item.id] });
      invalidateItems();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.deleteCommentFailed"));
    },
  });

  const comments = commentsQuery.data?.items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{t("itemDetailsTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="todo-body">{t("bodyLabel")}</Label>
            <Textarea
              id="todo-body"
              value={bodyDraft}
              onChange={(event) => setBodyDraft(event.target.value)}
              onBlur={commitBody}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              placeholder={t("bodyPlaceholder")}
              rows={2}
              disabled={!canEdit}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="todo-due-date">{t("dueDate")}</Label>
            <DatePicker
              id="todo-due-date"
              aria-label={t("dueDateAria")}
              value={item.dueDate ?? ""}
              onChange={(value) => updateItemMutation.mutate({ dueDate: value || null })}
              disabled={!canEdit}
              placeholder={t("dueDateNone")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="todo-priority">{t("priority")}</Label>
            <Select
              value={item.priority}
              onValueChange={(value) => updateItemMutation.mutate({ priority: value })}
              disabled={!canEdit}
            >
              <SelectTrigger id="todo-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("priorityLow")}</SelectItem>
                <SelectItem value="normal">{t("priorityNormal")}</SelectItem>
                <SelectItem value="high">{t("priorityHigh")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="todo-assignee">{t("assignee")}</Label>
            <Select
              value={item.assigneeUserId ?? UNASSIGNED}
              onValueChange={(value) =>
                updateItemMutation.mutate({ assigneeUserId: value === UNASSIGNED ? null : value })
              }
              disabled={!canEdit}
            >
              <SelectTrigger id="todo-assignee" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t("assigneeUnassignedOption")}</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium">{t("comments.title")}</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("comments.empty")}</p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="group rounded-xl border border-border bg-surface-muted p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      {comment.authorName || t("comments.unknownAuthor")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(comment.createdAt, locale)}
                      </span>
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                          disabled={deleteCommentMutation.isPending}
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                          aria-label={t("comments.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                </div>
              ))
            )}
          </div>

          {canEdit ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!commentBody.trim()) return;
                addCommentMutation.mutate(commentBody.trim());
              }}
            >
              <Textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder={t("comments.placeholder")}
                rows={2}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={addCommentMutation.isPending || !commentBody.trim()}
                aria-label={t("comments.send")}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
