import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
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
  const t = await getTranslations("Admin.page");

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
  });

  return (
    <PageContainer
      user={user}
      title={t("title")}
      description={t("description")}
    >
      <AdminShell>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminOverview />
      </HydrationBoundary>
      </AdminShell>
    </PageContainer>
  );
}
