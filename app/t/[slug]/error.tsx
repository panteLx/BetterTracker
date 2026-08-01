"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PublicTrackerError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const t = useTranslations("PublicShare");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-expense/30 bg-expense-muted/50">
        <AlertTriangle className="h-5 w-5 text-expense" />
      </div>
      <div className="space-y-1 text-center">
        <p className="font-semibold">{t("error.title")}</p>
        <p className="text-sm text-muted-foreground">
          {error.message || t("error.defaultMessage")}
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">{t("error.loginButton")}</Link>
      </Button>
    </div>
  );
}
