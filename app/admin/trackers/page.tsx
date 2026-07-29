import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminTrackersClient } from "@/components/admin/admin-trackers-client";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export default async function AdminTrackersPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect("/");
  }

  return (
    <PageContainer
      user={user}
      title="Tracker"
      description="Tracker anlegen, archivieren und ihre Discord-Anbindung verwalten."
    >
      <AdminShell>
      <AdminTrackersClient />
      </AdminShell>
    </PageContainer>
  );
}
