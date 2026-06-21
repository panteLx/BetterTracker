import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { PageContainer } from "@/components/layout/page-container";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { getServerSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  await ensureBootstrapForUser(session.user.id);

  return (
    <PageContainer
      user={session.user}
      title="Dashboard"
      description="Erfasse deine Ausgaben und behalte den Überblick über deine Finanzen mit BetterTracker."
    >
      <DashboardClient locale={env.defaultLocale} />
    </PageContainer>
  );
}
