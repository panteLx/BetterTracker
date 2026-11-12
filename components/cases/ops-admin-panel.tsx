"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/ui/section-card";
import { fetchJson } from "@/lib/client-fetch";
import type { OpsFixedCodes } from "@/components/cases/ops-client";

const FIXED_KEYS = ["letterPost", "letterFax", "flatUnder60", "flatFrom60"] as const;

function UploadButton({ kind }: { kind: "anhang2" | "hybrid" }) {
  const t = useTranslations("Cases.ops");
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch("/api/ops/upload", { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("admin.uploadFailed"));
      }
    },
    onSuccess: async () => {
      toast.success(t("admin.uploaded"));
      await queryClient.invalidateQueries({ queryKey: ["ops"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`ops-upload-${kind}`}>{t(`dataset.${kind}`)}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`ops-upload-${kind}`}
          type="file"
          accept=".xlsx"
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
        {upload.isPending ? <span className="text-xs text-muted-foreground">{t("admin.uploading")}</span> : null}
      </div>
    </div>
  );
}

export function OpsAdminPanel({ fixedCodes }: { fixedCodes: OpsFixedCodes }) {
  const t = useTranslations("Cases.ops");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OpsFixedCodes>(fixedCodes);
  const valid = FIXED_KEYS.every((k) => /^\d{1,10}$/.test(draft[k].trim()));

  const save = useMutation({
    mutationFn: () =>
      fetchJson("/api/ops/fixed-codes", { method: "PUT", body: JSON.stringify(draft) }),
    onSuccess: async () => {
      toast.success(t("admin.saved"));
      await queryClient.invalidateQueries({ queryKey: ["ops"] });
    },
    onError: () => toast.error(t("admin.saveFailed")),
  });

  return (
    <SectionCard>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ops-admin-content"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {t("admin.title")}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      <div id="ops-admin-content" hidden={!open} className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <UploadButton kind="anhang2" />
          <UploadButton kind="hybrid" />
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <h3 className="text-sm font-medium">{t("admin.fixedTitle")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIXED_KEYS.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`ops-fixed-${key}`}>{t(`fields.${key}`)}</Label>
                <Input
                  id={`ops-fixed-${key}`}
                  inputMode="numeric"
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  aria-invalid={!/^\d{1,10}$/.test(draft[key].trim())}
                  className="font-mono"
                />
              </div>
            ))}
          </div>
          {!valid ? <p className="text-xs text-destructive">{t("admin.digitsOnly")}</p> : null}
          <Button type="submit" size="sm" disabled={!valid || save.isPending}>
            <Upload className="h-4 w-4" />
            {save.isPending ? t("admin.saving") : t("admin.save")}
          </Button>
        </form>
      </div>
    </SectionCard>
  );
}
