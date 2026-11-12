import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { OpsClient } from "@/components/cases/ops-client";
import { requireCaseModuleUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { getCaseWorkspaceAccessForUser, listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { getOpsOverview, searchOps } from "@/lib/services/ops-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspaceOpsPage({
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
    queryKey: ["ops", ""],
    queryFn: async () => ({ ...(await searchOps("")), ...(await getOpsOverview()) }),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OpsClient isAdmin={isAdminRole(user.role)} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
