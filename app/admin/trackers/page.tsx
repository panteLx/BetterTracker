import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminTrackersClient } from "@/components/admin/admin-trackers-client";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export default async function AdminTrackersPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }
  const t = await getTranslations("Admin.trackers.page");

  return (
    <PageContainer
      user={user}
      title={t("title")}
      description={t("description")}
    >
      <AdminShell>
      <AdminTrackersClient />
      </AdminShell>
    </PageContainer>
  );
}
