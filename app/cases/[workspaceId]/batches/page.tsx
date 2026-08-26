import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { BatchesClient } from "@/components/cases/batches-client";
import { requireCaseModuleUser } from "@/lib/auth/session";
import { getCaseWorkspaceAccessForUser, listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { listPvsSubmissionBatches } from "@/lib/services/pvs-submission-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspaceBatchesPage({
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
    queryKey: ["pvs-batches", workspaceId],
    queryFn: () => listPvsSubmissionBatches(workspaceId).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <BatchesClient workspaceId={workspaceId} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
