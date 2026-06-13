import { redirect } from "next/navigation";
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
      title="Admin Settings"
      description="Locale, Zeitzone, Registrierung und Discord-Integrationen verwalten."
    >
      <AdminSettingsClient />
    </PageContainer>
  );
}
