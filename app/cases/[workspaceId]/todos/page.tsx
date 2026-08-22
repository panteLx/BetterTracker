import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { TodoBoardClient } from "@/components/cases/todo-board-client";
import { requireUser } from "@/lib/auth/session";
import { getCaseWorkspaceAccessForUser, listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { listTodoLists } from "@/lib/services/todo-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspaceTodosPage({
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
    queryKey: ["todo-lists", workspaceId],
    queryFn: () => listTodoLists(workspaceId).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TodoBoardClient workspaceId={workspaceId} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
