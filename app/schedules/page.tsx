import { PageContainer } from "@/components/layout/page-container";
import { SchedulesClient } from "@/components/schedules/schedules-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";

export default async function SchedulesPage() {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);

  return (
    <PageContainer
      user={user}
      title="Termine"
      description="Wiederkehrende Verpflichtungen verwalten und bei Bedarf direkt als Transaktion uebernehmen."
    >
      <SchedulesClient locale={env.defaultLocale} currentUserId={user.id} />
    </PageContainer>
  );
}
