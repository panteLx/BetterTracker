import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
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
      title="Benutzer"
      description="Rollen vergeben, Konten sperren und Benutzer verwalten."
    >
      <AdminShell>
      <AdminUsersClient currentRole={user.role || "user"} currentUserId={user.id} />
      </AdminShell>
    </PageContainer>
  );
}
