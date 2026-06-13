import { redirect } from "next/navigation";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }

  return (
    <PageContainer
      user={user}
      title="Admin Users"
      description="Benutzerrollen, Bans und grundlegende Identitätsverwaltung."
    >
      <AdminUsersClient currentRole={user.role || "user"} />
    </PageContainer>
  );
}
