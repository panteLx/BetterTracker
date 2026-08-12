"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { SignOutButton } from "@/components/profile/sign-out-button";

type AccountDetailsCardProps = {
  initialName: string;
  initialEmail: string;
  role: string | null;
  banned: boolean;
};

export function AccountDetailsCard({
  initialName,
  initialEmail,
  role,
  banned,
}: AccountDetailsCardProps) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();

      await fetchJson("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });

      toast.success(t("account.saveSuccess"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("account.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionCard
      title={t("account.title")}
      titleRight={
        role ? (
          <Badge variant="outline" className="text-xs">
            {role}
          </Badge>
        ) : null
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="account-name">{t("account.name")}</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("account.namePlaceholder")}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">{t("account.email")}</Label>
          <Input
            id="account-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("account.emailPlaceholder")}
            required
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">{t("account.status")}</span>
          {banned ? (
            <Badge variant="destructive" className="text-xs">{t("account.banned")}</Badge>
          ) : (
            <Badge variant="secondary" className="border-income/30 bg-income-muted text-income text-xs">
              {t("account.active")}
            </Badge>
          )}
        </div>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? t("account.saving") : t("account.save")}
        </Button>
      </form>
      <div className="mt-5 border-t border-border pt-5">
        <SignOutButton />
      </div>
    </SectionCard>
  );
}
