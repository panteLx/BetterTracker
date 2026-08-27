"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Stethoscope, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson, FetchError } from "@/lib/client-fetch";
import { formatDateTime } from "@/lib/utils";

type Status = { count: number; lastImportedAt: string | number | null };

async function uploadIcd10Zip(endpoint: string, file: File): Promise<Record<string, number>> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(endpoint, { method: "POST", body: formData });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }));
    throw new FetchError(body.error || "Request failed", response.status);
  }

  return response.json() as Promise<Record<string, number>>;
}

function Icd10ImportCard({
  namespace,
  endpoint,
  queryKey,
  timezone,
  resultDescription,
}: {
  namespace: string;
  endpoint: string;
  queryKey: string;
  timezone: string;
  resultDescription: (result: Record<string, number>) => string;
}) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, number> | null>(null);

  const statusQuery = useQuery({
    queryKey: [queryKey],
    queryFn: () => fetchJson<Status>(endpoint),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => uploadIcd10Zip(endpoint, file),
    onSuccess: (result) => {
      setLastResult(result);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(t("toasts.success", { count: result.count }));
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile) return;
    importMutation.mutate(selectedFile);
  }

  const status = statusQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          {t("card.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Alert>
          <AlertTitle>{t("info.title")}</AlertTitle>
          <AlertDescription>{t("info.description")}</AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">
          {status
            ? status.count > 0
              ? t("status.current", {
                  count: status.count,
                  date: status.lastImportedAt ? formatDateTime(status.lastImportedAt, locale, timezone) : "—",
                })
              : t("status.empty")
            : t("status.loading")}
        </p>

        <form onSubmit={handleSubmit} className="grid gap-3 sm:flex sm:items-end sm:gap-3">
          <div className="grid gap-1.5 sm:flex-1">
            <Label htmlFor={`${queryKey}-file`}>{t("form.fileLabel")}</Label>
            <Input
              id={`${queryKey}-file`}
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              disabled={importMutation.isPending}
            />
          </div>
          <Button type="submit" disabled={!selectedFile || importMutation.isPending}>
            <Upload className="h-4 w-4" />
            {importMutation.isPending ? t("form.importing") : t("form.import")}
          </Button>
        </form>

        {lastResult ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t("result.title")}</AlertTitle>
            <AlertDescription>{resultDescription(lastResult)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AdminIcd10ImportClient({ timezone }: { timezone: string }) {
  const t = useTranslations("Admin.icd10Import");
  const tAlpha = useTranslations("Admin.icd10AlphaImport");

  return (
    <div className="grid gap-6">
      <Icd10ImportCard
        namespace="Admin.icd10Import"
        endpoint="/api/admin/icd10-import"
        queryKey="admin-icd10-import-status"
        timezone={timezone}
        resultDescription={(result) =>
          t("result.description", { count: result.count, skipped: result.skippedNotAmbulant })
        }
      />
      <Icd10ImportCard
        namespace="Admin.icd10AlphaImport"
        endpoint="/api/admin/icd10-alpha-import"
        queryKey="admin-icd10-alpha-import-status"
        timezone={timezone}
        resultDescription={(result) =>
          tAlpha("result.description", { count: result.count, distinctCodes: result.distinctCodes })
        }
      />
    </div>
  );
}
