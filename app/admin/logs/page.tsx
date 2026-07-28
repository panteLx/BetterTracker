import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { desc, eq } from "drizzle-orm";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLogsClient } from "@/components/admin/admin-logs-client";
import { PageContainer } from "@/components/layout/page-container";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditLogs, user } from "@/lib/db/schema";
import { makeQueryClient } from "@/lib/query-client";

async function fetchInitialLogs() {
  const items = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      actorUserName: user.name,
      actorUserEmail: user.email,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      severity: auditLogs.severity,
      metadataJson: auditLogs.metadataJson,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(user, eq(user.id, auditLogs.actorUserId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);
  return { items };
}

export default async function AdminLogsPage() {
  const loggedInUser = await requireUser();
  if (loggedInUser.role !== "admin" && loggedInUser.role !== "superadmin") {
    redirect("/");
  }

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["admin-logs", ""],
    queryFn: fetchInitialLogs,
  });

  return (
    <PageContainer
      user={loggedInUser}
      title="Admin Logs"
      description="Audit-Log mit den letzten System- und Mutationsereignissen."
    >
      <AdminNav />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminLogsClient locale={env.defaultLocale} timezone={env.timezone} currentRole={loggedInUser.role} />
      </HydrationBoundary>
    </PageContainer>
  );
}
