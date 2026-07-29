import { PageContainer } from "@/components/layout/page-container";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/profile/sign-out-button";
import { AppearanceCard } from "@/components/profile/appearance-card";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import {
  requireUser,
  getActiveSessionsForUser,
  getCurrentUserRecord,
} from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export default async function ProfilePage() {
  const current = await requireUser();
  await ensureBootstrapForUser(current.id);
  const [userRecord, sessions] = await Promise.all([
    getCurrentUserRecord(current.id),
    getActiveSessionsForUser(current.id),
  ]);

  return (
    <PageContainer
      user={current}
      title="Profil"
      description="Dein Konto, deine Sitzungen und wie die App aussehen soll."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AppearanceCard />

        <SectionCard
          title="Account"
          titleRight={
            userRecord?.role ? (
              <Badge variant="outline" className="text-xs">
                {userRecord.role}
              </Badge>
            ) : null
          }
        >
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{userRecord?.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
              <dt className="text-muted-foreground">E-Mail</dt>
              <dd className="font-medium">{userRecord?.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {userRecord?.banned ? (
                  <Badge variant="destructive" className="text-xs">Gesperrt</Badge>
                ) : (
                  <Badge variant="secondary" className="border-income/30 bg-income-muted text-income text-xs">Aktiv</Badge>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-border pt-5">
            <SignOutButton />
          </div>
        </SectionCard>

        <SectionCard
          title="Aktive Sessions"
          titleRight={
            <span className="rounded-pill border border-border bg-card px-2.5 py-0.5 font-subtext text-xs font-medium text-muted-foreground">
              {sessions.length} aktiv
            </span>
          }
        >
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine aktiven Sessions gefunden.</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm"
                >
                  <p className="font-medium">{session.userAgent || "Unbekanntes Gerät"}</p>
                  <p className="font-subtext text-xs text-muted-foreground">
                    Läuft bis {formatDateTime(session.expiresAt, env.defaultLocale, env.timezone)}
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
