import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { LandingPage } from "@/components/landing";
import { PageContainer } from "@/components/layout/page-container";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { getServerSession } from "@/lib/auth/session";
import { getRegistrationEnabled } from "@/lib/services/admin-settings-service";

export default async function Home() {
  const session = await getServerSession();
  const registrationEnabled = await getRegistrationEnabled();

  if (!session?.user) {
    return <LandingPage registrationEnabled={registrationEnabled} />;
  }

  await ensureBootstrapForUser(session.user.id);

  return (
    <PageContainer
      user={session.user}
      title="Buchungen"
      description="Transaktionen fuer deine Tracker erfassen und letzte Eintraege direkt im Blick behalten."
    >
      <DashboardClient locale={env.defaultLocale} />
    </PageContainer>
  );
}
