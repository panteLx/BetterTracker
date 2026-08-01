import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }
  const t = await getTranslations("Admin.users.page");

  return (
    <PageContainer
      user={user}
      title={t("title")}
      description={t("description")}
    >
      <AdminShell>
      <AdminUsersClient currentRole={user.role || "user"} currentUserId={user.id} />
      </AdminShell>
    </PageContainer>
  );
}
