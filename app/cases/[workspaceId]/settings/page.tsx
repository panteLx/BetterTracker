import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { CaseWorkspaceSettingsClient } from "@/components/cases/case-workspace-settings-client";
import { requireCaseModuleUser } from "@/lib/auth/session";
import { getCaseWorkspaceAccessForUser, listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const user = await requireCaseModuleUser();
  const { workspaceId } = await params;

  const access = await getCaseWorkspaceAccessForUser(workspaceId, user.id, { includeHidden: true });
  if (!access?.canManageWorkspace) {
    redirect(`/cases/${workspaceId}`);
  }

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => listCaseWorkspacesForUser(user.id).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CaseWorkspaceSettingsClient workspaceId={workspaceId} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
