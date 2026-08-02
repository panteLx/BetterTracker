import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { PageContainer } from "@/components/layout/page-container";
import { SiteMessageBanner } from "@/components/site-message-banner";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { getServerSession } from "@/lib/auth/session";
import { listTrackersForUser } from "@/lib/auth/tracker-access";
import { makeQueryClient } from "@/lib/query-client";
import { getDashboardMessage } from "@/lib/services/admin-settings-service";

export default async function Home() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  await ensureBootstrapForUser(session.user.id);

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["trackers"],
    queryFn: () =>
      listTrackersForUser(session.user.id).then((items) => ({ items })),
  });

  const t = await getTranslations("Dashboard");
  const dashboardMessage = await getDashboardMessage();

  return (
    <PageContainer
      user={session.user}
      title={t("title")}
      description={t("description")}
    >
      <SiteMessageBanner message={dashboardMessage} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardClient />
      </HydrationBoundary>
    </PageContainer>
  );
}
