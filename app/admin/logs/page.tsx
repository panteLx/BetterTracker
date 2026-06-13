import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLogsClient } from "@/components/admin/admin-logs-client";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export default async function AdminLogsPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }

  return (
    <PageContainer
      user={user}
      title="Admin Logs"
      description="Audit-Log mit den letzten System- und Mutationsereignissen."
    >
      <AdminNav />
      <AdminLogsClient />
    </PageContainer>
  );
}
