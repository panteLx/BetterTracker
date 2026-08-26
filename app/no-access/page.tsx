import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";

export default async function NoAccessPage() {
  const user = await requireUser();
  const t = await getTranslations("NoAccess");

  return (
    <PageContainer user={user} hideQuickAdd>
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-muted">
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{t("page.title")}</p>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/profile">{t("profileLink")}</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
