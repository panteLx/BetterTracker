import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/page-container";
import { StatisticsClient } from "@/components/statistics/statistics-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { listTrackersForUser } from "@/lib/auth/tracker-access";
import { makeQueryClient } from "@/lib/query-client";

export default async function StatisticsPage() {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["trackers"],
    queryFn: () => listTrackersForUser(user.id).then((items) => ({ items })),
  });

  return (
    <PageContainer
      user={user}
      title="Statistiken"
      description="Übersicht über Einnahmen, Ausgaben und Trends deiner Buchungen."
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <StatisticsClient locale={env.defaultLocale} />
      </HydrationBoundary>
    </PageContainer>
  );
}
