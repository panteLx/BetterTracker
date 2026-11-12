import { redirect } from "next/navigation";

export default async function LegacyInvoicesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/cases/${workspaceId}/submissions?tab=invoices`);
}
