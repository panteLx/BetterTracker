import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
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
      title="Admin Trackers"
      description="Tracker anlegen, archivieren und ihre individuellen Discord-Settings verwalten."
    >
      <AdminNav />
      <AdminTrackersClient />
    </PageContainer>
  );
}
