"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { MicroLabel } from "@/components/ui/micro-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/client-fetch";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

export function LanguageCard() {
  const t = useTranslations("Profile.language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Locale>(locale as Locale);

  function selectLocale(next: Locale) {
    if (next === selected) return;
    setSelected(next);

    startTransition(async () => {
      await fetchJson("/api/locale", {
        method: "POST",
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  }

  return (
    <SectionCard title={t("title")}>
      <div className="space-y-2">
        <MicroLabel>{t("label")}</MicroLabel>
        <p className="font-subtext text-sm text-muted-foreground">
          {t("description")}
        </p>
        <div className="pt-2">
          <Select
            value={selected}
            onValueChange={(value) => selectLocale(value as Locale)}
            disabled={pending}
          >
            <SelectTrigger className="w-48">
              <Languages className="h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LOCALES.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionCard>
  );
}
