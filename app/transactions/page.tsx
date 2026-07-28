import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { listTrackersForUser } from "@/lib/auth/tracker-access";
import { makeQueryClient } from "@/lib/query-client";

export default async function TransactionsPage() {
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
      title="Transaktionen"
      description="Filterbare Historie mit Summen für Einnahmen, Ausgaben und Saldo."
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TransactionsClient locale={env.defaultLocale} currentUserId={user.id} />
      </HydrationBoundary>
    </PageContainer>
  );
}
