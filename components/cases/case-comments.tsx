"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/client-fetch";
import { formatDateTime } from "@/lib/utils";

type CaseFileComment = {
  id: string;
  caseFileId: string;
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
};

export function CaseComments({
  workspaceId,
  caseFileId,
  canComment = true,
}: {
  workspaceId: string;
  caseFileId: string;
  canComment?: boolean;
}) {
  const t = useTranslations("Cases.comments");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const commentsQuery = useQuery({
    queryKey: ["case-file-comments", caseFileId],
    queryFn: () =>
      fetchJson<{ items: CaseFileComment[] }>(
        `/api/case-workspaces/${workspaceId}/case-files/${caseFileId}/comments`
      ),
  });

  const addCommentMutation = useMutation({
    mutationFn: (payload: { body: string }) =>
      fetchJson<{ item: CaseFileComment }>(
        `/api/case-workspaces/${workspaceId}/case-files/${caseFileId}/comments`,
        { method: "POST", body: JSON.stringify(payload) }
      ),
    onSuccess: () => {
      // The insert response is a raw table row without the joined author
      // name, so refetch instead of splicing it in — otherwise the new
      // comment would briefly (or permanently, without another refetch)
      // show as authored by "Unknown".
      queryClient.invalidateQueries({ queryKey: ["case-file-comments", caseFileId] });
      queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
      setBody("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("addFailed"));
    },
  });

  const comments = commentsQuery.data?.items || [];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-border bg-surface-muted p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{comment.authorName || t("unknownAuthor")}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(comment.createdAt, locale)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
            </div>
          ))
        )}
      </div>

      {canComment ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim()) return;
            addCommentMutation.mutate({ body: body.trim() });
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("placeholder")}
            rows={2}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={addCommentMutation.isPending || !body.trim()}
            aria-label={t("send")}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : null}
    </div>
  );
}
