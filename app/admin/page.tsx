import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminOverview } from "@/components/admin/admin-overview";
import { PageContainer } from "@/components/layout/page-container";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { requireUser } from "@/lib/auth/session";

export default async function AdminPage() {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }

  return (
    <PageContainer
      user={user}
      title="Admin"
      description="Systemweite Kennzahlen und Einstieg in Benutzer-, Tracker- und Settings-Verwaltung."
    >
      <AdminNav />
      <AdminOverview />
    </PageContainer>
  );
}
