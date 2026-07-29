import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSettingsClient } from "@/components/admin/admin-settings-client";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }

  return (
    <PageContainer
      user={user}
      title="Einstellungen"
      description="Systemweite Vorgaben und die Discord-Anbindung."
    >
      <AdminShell>
      <AdminSettingsClient
        currentRole={user.role === "superadmin" ? "superadmin" : "admin"}
      />
      </AdminShell>
    </PageContainer>
  );
}
