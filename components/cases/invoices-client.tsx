"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, FileText, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { InvoiceAssignDialog, InvoiceUploadDialog } from "@/components/cases/invoice-dialogs";
import { fetchJson } from "@/lib/client-fetch";
import { formatDateTime } from "@/lib/utils";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";

type InvoiceCaseFile = { id: string; patientName: string; fileNumber: string };

type CaseInvoice = {
  id: string;
  originalFileName: string;
  sizeBytes: number;
  createdAt: string;
  caseFiles: InvoiceCaseFile[];
};

type CaseWorkspace = {
  id: string;
  isActive: boolean;
  permission: "owner" | "admin" | "write" | "read";
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function InvoiceRow({
  workspaceId,
  invoice,
  canEdit,
}: {
  workspaceId: string;
  invoice: CaseInvoice;
  canEdit: boolean;
}) {
  const t = useTranslations("Cases.invoices");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["case-invoices", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["case-invoices-assignable", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
  }

  const unassign = useMutation({
    mutationFn: (caseFileId: string) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/invoices/${invoice.id}/unassign`, {
        method: "POST",
        body: JSON.stringify({ caseFileIds: [caseFileId] }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.removed"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.removeFailed")),
  });

  const remove = useMutation({
    mutationFn: () =>
      fetchJson(`/api/case-workspaces/${workspaceId}/invoices/${invoice.id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.deleted"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.deleteFailed")),
  });

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={`/api/case-workspaces/${workspaceId}/invoices/${invoice.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{invoice.originalFileName}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatSize(invoice.sizeBytes)} · {formatDateTime(invoice.createdAt, locale)}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
              <UserPlus className="h-4 w-4" />
              {t("addPatients")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              {t("delete")}
            </Button>
          </div>
        ) : null}
      </div>

      {invoice.caseFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noPatients")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {invoice.caseFiles.map((caseFile) => (
            <Badge key={caseFile.id} variant="secondary" className="gap-1.5">
              {caseFile.patientName} · {caseFile.fileNumber}
              {canEdit ? (
                <button
                  type="button"
                  aria-label={t("removePatientAria", { name: caseFile.patientName })}
                  disabled={unassign.isPending}
                  onClick={() => unassign.mutate(caseFile.id)}
                  className="rounded-sm hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
      )}

      <InvoiceAssignDialog
        workspaceId={workspaceId}
        invoiceId={invoice.id}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { count: invoice.caseFiles.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>{t("deleteConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function InvoicesClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("Cases.invoices");
  const [uploadOpen, setUploadOpen] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canEdit = workspace ? canWriteWorkspace(workspace.permission) && workspace.isActive : false;

  const invoicesQuery = useQuery({
    queryKey: ["case-invoices", workspaceId],
    queryFn: () => fetchJson<{ items: CaseInvoice[] }>(`/api/case-workspaces/${workspaceId}/invoices`),
  });
  const invoices = invoicesQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("upload")}
          </Button>
        </div>
      ) : null}

      {!invoicesQuery.isLoading && invoices.length === 0 ? (
        <EmptyState icon={FileText} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <SectionCard noPadding>
          <div className="space-y-3 p-3">
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} workspaceId={workspaceId} invoice={invoice} canEdit={canEdit} />
            ))}
          </div>
        </SectionCard>
      )}

      {canEdit ? (
        <InvoiceUploadDialog workspaceId={workspaceId} open={uploadOpen} onOpenChange={setUploadOpen} />
      ) : null}
    </div>
  );
}
