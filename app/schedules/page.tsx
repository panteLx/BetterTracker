import { PageContainer } from "@/components/layout/page-container";
import { SchedulesClient } from "@/components/schedules/schedules-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { requireUser } from "@/lib/auth/session";

export default async function SchedulesPage() {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);

  return (
    <PageContainer
      user={user}
      title="Schedules"
      description="Wiederkehrende Verpflichtungen verwalten und bei Bedarf direkt als Transaktion übernehmen."
    >
      <SchedulesClient />
    </PageContainer>
  );
}
