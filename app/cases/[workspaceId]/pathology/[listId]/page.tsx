import { notFound, redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { PathologyListClient } from "@/components/cases/pathology-list-client";
import { requireCaseModuleUser } from "@/lib/auth/session";
import {
  getCaseWorkspaceAccessForUser,
  listCaseWorkspacesForUser,
} from "@/lib/auth/case-workspace-access";
import { getPathologyList, listInsurerSuggestions } from "@/lib/services/pathology-service";
import { isHttpError } from "@/lib/errors";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspacePathologyListPage({
  params,
}: {
  params: Promise<{ workspaceId: string; listId: string }>;
}) {
  const user = await requireCaseModuleUser();
  const { workspaceId, listId } = await params;

  const access = await getCaseWorkspaceAccessForUser(workspaceId, user.id);
  if (!access) {
    redirect("/cases");
  }

  const list = await getPathologyList(workspaceId, listId).catch((error) => {
    if (isHttpError(error) && error.status === 404) return null;
    throw error;
  });
  if (!list) notFound();

  const queryClient = makeQueryClient();
  queryClient.setQueryData(["pathology-list", workspaceId, listId], { item: list });
  await queryClient.prefetchQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => listCaseWorkspacesForUser(user.id).then((items) => ({ items })),
  });
  await queryClient.prefetchQuery({
    queryKey: ["pathology-insurers", workspaceId],
    queryFn: () => listInsurerSuggestions(workspaceId).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PathologyListClient workspaceId={workspaceId} listId={listId} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
