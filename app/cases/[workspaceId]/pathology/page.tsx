import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { PathologyListsClient } from "@/components/cases/pathology-lists-client";
import { requireCaseModuleUser } from "@/lib/auth/session";
import {
  getCaseWorkspaceAccessForUser,
  listCaseWorkspacesForUser,
} from "@/lib/auth/case-workspace-access";
import { listPathologyLists } from "@/lib/services/pathology-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspacePathologyPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const user = await requireCaseModuleUser();
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
    queryKey: ["pathology-lists", workspaceId, false],
    queryFn: () => listPathologyLists(workspaceId, false).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PathologyListsClient workspaceId={workspaceId} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
