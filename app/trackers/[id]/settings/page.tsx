import { PageContainer } from "@/components/layout/page-container";
import { TrackerSettingsClient } from "@/components/trackers/tracker-settings-client";
import { getTrackerAccessForUser } from "@/lib/auth/tracker-access";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function TrackerSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);
  const { id } = await params;
  const access = await getTrackerAccessForUser(id, user.id, {
    includeHidden: true,
  });
  if (!access?.canManageTracker) {
    redirect("/");
  }

  return (
    <PageContainer
      user={user}
      title="Tracker-Settings"
      description="Tracker-Stammdaten bearbeiten sowie Kategorien und Einzahler gesammelt verwalten."
    >
      <TrackerSettingsClient initialTrackerId={id} locale={env.defaultLocale} />
    </PageContainer>
  );
}
