import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CasesPageContainer } from "@/components/layout/cases-page-container";
import { InvoicesClient } from "@/components/cases/invoices-client";
import { requireCaseModuleUser } from "@/lib/auth/session";
import { getCaseWorkspaceAccessForUser, listCaseWorkspacesForUser } from "@/lib/auth/case-workspace-access";
import { listAssignableCaseFiles, listInvoices } from "@/lib/services/case-invoice-service";
import { makeQueryClient } from "@/lib/query-client";

export default async function CaseWorkspaceInvoicesPage({
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
    queryKey: ["case-invoices", workspaceId],
    queryFn: () => listInvoices(workspaceId).then((items) => ({ items })),
  });
  await queryClient.prefetchQuery({
    queryKey: ["case-invoices-assignable", workspaceId],
    queryFn: () => listAssignableCaseFiles(workspaceId).then((items) => ({ items })),
  });

  return (
    <CasesPageContainer user={user} workspaceId={workspaceId} hideHeader>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <InvoicesClient workspaceId={workspaceId} />
      </HydrationBoundary>
    </CasesPageContainer>
  );
}
