import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { requireTrackerModuleUser } from "@/lib/auth/session";
import { listTrackersForUser } from "@/lib/auth/tracker-access";
import { makeQueryClient } from "@/lib/query-client";

export default async function TransactionsPage() {
  const user = await requireTrackerModuleUser();
  await ensureBootstrapForUser(user.id);
  const t = await getTranslations("Transactions");

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["trackers"],
    queryFn: () => listTrackersForUser(user.id).then((items) => ({ items })),
  });

  return (
    <PageContainer
      user={user}
      title={t("page.title")}
      description={t("page.description")}
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TransactionsClient currentUserId={user.id} />
      </HydrationBoundary>
    </PageContainer>
  );
}
