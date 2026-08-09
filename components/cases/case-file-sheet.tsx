"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CaseComments } from "@/components/cases/case-comments";
import { CaseStatusHistory } from "@/components/cases/case-status-history";
import { fetchJson, FetchError } from "@/lib/client-fetch";
import { formatDateTime } from "@/lib/utils";
import type { CaseFile } from "@/components/cases/case-board-client";

type CaseFileSheetProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseFile?: CaseFile | null;
};

const CASE_TYPES = ["ambulant", "stationaer", "konsil"] as const;

export function CaseFileSheet({ workspaceId, open, onOpenChange, caseFile }: CaseFileSheetProps) {
  const t = useTranslations("Cases.caseFileForm");
  const tCaseType = useTranslations("Cases.caseType");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const isEdit = Boolean(caseFile);
  const readOnly = isEdit && !caseFile?.canEdit;

  function reportSaveError(error: unknown) {
    if (error instanceof FetchError && error.status === 409) {
      toast.error(t("toast.duplicateFileNumber"));
      return;
    }
    toast.error(error instanceof Error ? error.message : t("toast.saveFailed"));
  }

  const [patientName, setPatientName] = useState(caseFile?.patientName ?? "");
  const [fileNumber, setFileNumber] = useState(caseFile?.fileNumber ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(caseFile?.dateOfBirth ?? "");
  const [caseType, setCaseType] = useState<(typeof CASE_TYPES)[number]>(
    caseFile?.caseType ?? "ambulant"
  );

  // Re-seeds the form fields whenever the sheet opens, without resetting on
  // every re-render — adjusting state during render (rather than in an
  // effect) per https://react.dev/learn/you-might-not-need-an-effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPatientName(caseFile?.patientName ?? "");
      setFileNumber(caseFile?.fileNumber ?? "");
      setDateOfBirth(caseFile?.dateOfBirth ?? "");
      setCaseType(caseFile?.caseType ?? "ambulant");
    }
  }

  function invalidateCaseFiles() {
    queryClient.invalidateQueries({ queryKey: ["case-files", workspaceId] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: {
      patientName: string;
      fileNumber: string;
      dateOfBirth: string | null;
      caseType: string;
    }) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      invalidateCaseFiles();
      toast.success(t("toast.created"));
      onOpenChange(false);
    },
    onError: reportSaveError,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      patientName: string;
      fileNumber: string;
      dateOfBirth: string | null;
      caseType: string;
    }) =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files/${caseFile!.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      invalidateCaseFiles();
      toast.success(t("toast.saved"));
    },
    onError: reportSaveError,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/case-workspaces/${workspaceId}/case-files/${caseFile!.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidateCaseFiles();
      toast.success(t("toast.deleted"));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toast.deleteFailed"));
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patientName.trim() || !fileNumber.trim()) {
      toast.error(t("toast.requiredFields"));
      return;
    }

    const payload = {
      patientName: patientName.trim(),
      fileNumber: fileNumber.trim(),
      dateOfBirth: dateOfBirth || null,
      caseType,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {isEdit && caseFile && caseFile.returnCount > 0 ? (
            <p className="rounded-lg bg-warning-muted px-3 py-2 text-xs text-warning">
              {t("returnedNotice", {
                count: caseFile.returnCount,
                date: caseFile.lastReturnedAt
                  ? formatDateTime(caseFile.lastReturnedAt, locale)
                  : "",
              })}
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="case-patient-name">{t("patientName")}</Label>
              <Input
                id="case-patient-name"
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                autoFocus
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-file-number">{t("fileNumber")}</Label>
              <Input
                id="case-file-number"
                value={fileNumber}
                onChange={(event) => setFileNumber(event.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-dob">{t("dateOfBirth")}</Label>
              <Input
                id="case-dob"
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-type">{t("caseType")}</Label>
              <Select
                value={caseType}
                onValueChange={(value) => setCaseType(value as typeof caseType)}
                disabled={readOnly}
              >
                <SelectTrigger id="case-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tCaseType(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {readOnly ? null : (
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? t("saving") : isEdit ? t("save") : t("create")}
              </Button>
            )}
          </form>

          {isEdit && caseFile ? (
            <>
              {caseFile.canDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t("confirmDelete"))) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("delete")}
                </Button>
              ) : null}

              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-medium">{t("statusHistoryTitle")}</h3>
                <CaseStatusHistory workspaceId={workspaceId} caseFileId={caseFile.id} />
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-medium">{t("commentsTitle")}</h3>
                <CaseComments
                  workspaceId={workspaceId}
                  caseFileId={caseFile.id}
                  canComment={caseFile.canEdit}
                />
              </div>
            </>
          ) : null}
        </div>
        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}
