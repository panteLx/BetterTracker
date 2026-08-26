import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCaseWorkspacesClient } from "@/components/admin/admin-case-workspaces-client";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export default async function AdminCaseWorkspacesPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }
  const t = await getTranslations("Admin.caseWorkspaces.page");

  return (
    <PageContainer
      user={user}
      title={t("title")}
      description={t("description")}
    >
      <AdminShell>
        <AdminCaseWorkspacesClient />
      </AdminShell>
    </PageContainer>
  );
}
