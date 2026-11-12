import { redirect } from "next/navigation";

export default async function LegacyBatchesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/cases/${workspaceId}/submissions`);
}
