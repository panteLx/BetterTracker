import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { CaseBoardClient } from "@/components/cases/case-board-client";
import { requireUser } from "@/lib/auth/session";
import { getCaseWorkspaceAccessForUser, listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { listCaseFiles } from "@/lib/services/case-file-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspaceBoardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const user = await requireUser();
  const { workspaceId } = await params;

  const access = await getCaseWorkspaceAccessForUser(workspaceId, user.id);
  if (!access) {
    redirect("/cases");
  }

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => listCaseWorkspacesForUser(user.id).then((items) => ({ items })),
  });
  await queryClient.prefetchQuery({
    queryKey: ["case-files", workspaceId, {}],
    queryFn: () =>
      listCaseFiles(workspaceId, {}, access.permission).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CaseBoardClient workspaceId={workspaceId} currentUserId={user.id} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
