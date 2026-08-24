import { requireCaseWorkspaceReadAccess } from "@/lib/auth/case-workspace-guards";
import { listCaseWorkspaceMembers } from "@/lib/auth/case-workspace-access";
import { ok, serverError } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireCaseWorkspaceReadAccess(request.headers, id);
  if (access.response) return access.response;

  try {
    const members = await listCaseWorkspaceMembers(id);
    const items = members.map((member) => ({
      userId: member.userId,
      name: member.userName,
      email: member.userEmail,
    }));
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}
