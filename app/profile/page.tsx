import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      description="Persönliche Kontoinformationen und aktive Sessions."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Name:</span> {userRecord?.name}
            </p>
            <p>
              <span className="font-medium">E-Mail:</span> {userRecord?.email}
            </p>
            <p>
              <span className="font-medium">Rolle:</span> {userRecord?.role}
            </p>
            <p>
              <span className="font-medium">Status:</span>{" "}
              {userRecord?.banned ? "Banned" : "Aktiv"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aktive Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-border/60 p-4 text-sm">
                <p className="font-medium">{session.userAgent || "Unbekanntes Gerät"}</p>
                <p className="text-muted-foreground">
                  Läuft bis {formatDateTime(session.expiresAt, env.defaultLocale, env.timezone)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
