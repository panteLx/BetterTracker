import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { TrackerSettingsClient } from "@/components/trackers/tracker-settings-client";
import { getTrackerAccessForUser } from "@/lib/auth/tracker-access";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
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
  const t = await getTranslations("Trackers");

  return (
    <PageContainer
      user={user}
      title={t("settingsPage.title")}
      description={t("settingsPage.description")}
    >
      <TrackerSettingsClient initialTrackerId={id} />
    </PageContainer>
  );
}
