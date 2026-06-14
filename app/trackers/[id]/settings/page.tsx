import { PageContainer } from "@/components/layout/page-container";
import { TrackerSettingsClient } from "@/components/trackers/tracker-settings-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";

export default async function TrackerSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);
  const { id } = await params;

  return (
    <PageContainer
      user={user}
      title="Tracker-Settings"
      description="Tracker-Stammdaten bearbeiten sowie Kategorien und Payees gesammelt verwalten."
    >
      <TrackerSettingsClient initialTrackerId={id} locale={env.defaultLocale} />
    </PageContainer>
  );
}
