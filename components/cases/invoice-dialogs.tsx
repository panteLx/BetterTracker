"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchJson } from "@/lib/client-fetch";

export type AssignableCaseFile = { id: string; patientName: string; fileNumber: string };

function useInvoiceInvalidation(workspaceId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["case-invoices", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["case-invoices-assignable", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
  };
}

function CaseFilePicker({
  workspaceId,
  selected,
  onChange,
}: {
  workspaceId: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const t = useTranslations("Cases.invoices");
  const query = useQuery({
    queryKey: ["case-invoices-assignable", workspaceId],
    queryFn: () =>
      fetchJson<{ items: AssignableCaseFile[] }>(
        `/api/case-workspaces/${workspaceId}/invoices/assignable`
      ),
  });
  const items = query.data?.items ?? [];

  if (!query.isLoading && items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noAssignable")}</p>;
  }

  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                if (checked) next.add(item.id);
                else next.delete(item.id);
                onChange(next);
              }}
            />
            <span className="font-medium">{item.patientName}</span>
            <span className="text-muted-foreground">{item.fileNumber}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function InvoiceUploadDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Cases.invoices");
  const invalidate = useInvoiceInvalidation(workspaceId);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("toast.noFile"));
      const form = new FormData();
      form.set("file", file);
      form.set("caseFileIds", JSON.stringify([...selected]));
      const response = await fetch(`/api/case-workspaces/${workspaceId}/invoices`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("toast.uploadFailed"));
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.uploaded"));
      setFile(null);
      setSelected(new Set());
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.uploadFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("uploadTitle")}</DialogTitle>
          <DialogDescription>{t("uploadDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-file">{t("fileLabel")}</Label>
            <Input
              id="invoice-file"
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("patientsLabel")}</Label>
            <CaseFilePicker workspaceId={workspaceId} selected={selected} onChange={setSelected} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
            {upload.isPending ? t("uploading") : t("uploadSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceAssignDialog({
  workspaceId,
  invoiceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Cases.invoices");
  const invalidate = useInvoiceInvalidation(workspaceId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const assign = useMutation({
    mutationFn: () =>
      fetchJson(`/api/case-workspaces/${workspaceId}/invoices/${invoiceId}/assign`, {
        method: "POST",
        body: JSON.stringify({ caseFileIds: [...selected] }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.assigned"));
      setSelected(new Set());
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.assignFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("assignTitle")}</DialogTitle>
          <DialogDescription>{t("assignDescription")}</DialogDescription>
        </DialogHeader>
        <CaseFilePicker workspaceId={workspaceId} selected={selected} onChange={setSelected} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={() => assign.mutate()} disabled={selected.size === 0 || assign.isPending}>
            {assign.isPending ? t("assigning") : t("assignSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
