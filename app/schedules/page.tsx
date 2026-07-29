import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/page-container";
import { SchedulesClient } from "@/components/schedules/schedules-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { listTrackersForUser } from "@/lib/auth/tracker-access";
import { makeQueryClient } from "@/lib/query-client";

export default async function SchedulesPage() {
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
      title="Termine"
      description="Wiederkehrende Zahlungen — fällige Termine übernimmst du mit einem Klick als Buchung."
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SchedulesClient locale={env.defaultLocale} currentUserId={user.id} />
      </HydrationBoundary>
    </PageContainer>
  );
}
