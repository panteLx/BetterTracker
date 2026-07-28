import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminOverview } from "@/components/admin/admin-overview";
import { PageContainer } from "@/components/layout/page-container";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { requireUser } from "@/lib/auth/session";
import { getAdminStats } from "@/lib/services/admin-stats-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function AdminPage() {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
  });

  return (
    <PageContainer
      user={user}
      title="Admin"
      description="Systemweite Kennzahlen und Einstieg in Benutzer-, Tracker- und Settings-Verwaltung."
    >
      <AdminNav />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminOverview />
      </HydrationBoundary>
    </PageContainer>
  );
}
