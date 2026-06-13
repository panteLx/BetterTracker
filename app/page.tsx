import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { LandingPage } from "@/components/landing";
import { PageContainer } from "@/components/layout/page-container";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { getServerSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getServerSession();

  if (!session?.user) {
    return <LandingPage />;
  }

  await ensureBootstrapForUser(session.user.id);

  return (
    <PageContainer
      user={session.user}
      title="Buchungen"
      description="Transaktionen fuer deine Tracker erfassen und letzte Eintraege direkt im Blick behalten."
    >
      <DashboardClient />
    </PageContainer>
  );
}
