import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { SectionCard } from "@/components/ui/section-card";
import { AppearanceCard } from "@/components/profile/appearance-card";
import { LanguageCard } from "@/components/profile/language-card";
import { AccountDetailsCard } from "@/components/profile/account-details-card";
import { ChangePasswordCard } from "@/components/profile/change-password-card";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import {
  requireUser,
  getActiveSessionsForUser,
  getCurrentUserRecord,
  hasCredentialAccount,
} from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export default async function ProfilePage() {
  const current = await requireUser();
  await ensureBootstrapForUser(current.id);
  const [userRecord, sessions, hasPassword, t, locale] = await Promise.all([
    getCurrentUserRecord(current.id),
    getActiveSessionsForUser(current.id),
    hasCredentialAccount(current.id),
    getTranslations("Profile"),
    getLocale(),
  ]);

  return (
    <PageContainer
      user={current}
      title={t("title")}
      description={t("description")}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AppearanceCard />
        <LanguageCard />

        <AccountDetailsCard
          initialName={userRecord?.name ?? ""}
          initialEmail={userRecord?.email ?? ""}
          role={userRecord?.role ?? null}
          banned={userRecord?.banned ?? false}
        />

        <ChangePasswordCard hasPassword={hasPassword} />

        <SectionCard
          title={t("sessions.title")}
          titleRight={
            <span className="rounded-pill border border-border bg-card px-2.5 py-0.5 font-subtext text-xs font-medium text-muted-foreground">
              {t("sessions.count", { count: sessions.length })}
            </span>
          }
        >
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("sessions.empty")}</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm"
                >
                  <p className="font-medium">{session.userAgent || t("sessions.unknownDevice")}</p>
                  <p className="font-subtext text-xs text-muted-foreground">
                    {t("sessions.expiresAt", {
                      date: formatDateTime(session.expiresAt, locale, env.timezone),
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
