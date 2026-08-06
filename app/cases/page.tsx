import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { CaseWorkspaceListClient } from "@/components/cases/case-workspace-list-client";
import { requireUser } from "@/lib/auth/session";
import { listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { makeQueryClient } from "@/lib/query-client";

export default async function CasesPage() {
  const user = await requireUser();
  const t = await getTranslations("Cases.workspaceList");

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => listCaseWorkspacesForUser(user.id).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} title={t("title")} description={t("description")}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CaseWorkspaceListClient />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
