import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminIcd10ImportClient } from "@/components/admin/admin-icd10-import-client";
import { PageContainer } from "@/components/layout/page-container";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { getIcd10AlphaImportStatus, getIcd10ImportStatus } from "@/lib/services/icd10-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function AdminIcd10ImportPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }

  const t = await getTranslations("Admin.icd10Import.page");
  const queryClient = makeQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["admin-icd10-import-status"],
      queryFn: getIcd10ImportStatus,
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin-icd10-alpha-import-status"],
      queryFn: getIcd10AlphaImportStatus,
    }),
  ]);

  return (
    <PageContainer user={user} title={t("title")} description={t("description")}>
      <AdminShell>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AdminIcd10ImportClient timezone={env.timezone} />
        </HydrationBoundary>
      </AdminShell>
    </PageContainer>
  );
}
