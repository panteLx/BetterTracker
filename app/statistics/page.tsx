import { PageContainer } from "@/components/layout/page-container";
import { StatisticsClient } from "@/components/statistics/statistics-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";

export default async function StatisticsPage() {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);

  return (
    <PageContainer
      user={user}
      title="Statistiken"
      description="Übersicht über Einnahmen, Ausgaben und Trends deiner Buchungen."
    >
      <StatisticsClient locale={env.defaultLocale} />
    </PageContainer>
  );
}
