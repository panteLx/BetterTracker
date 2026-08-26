import { NextResponse } from "next/server";
import { requireAuthenticatedApi } from "@/lib/auth/guards";
import { getCaseWorkspaceAccessForUser } from "@/lib/auth/case-workspace-access";
import { canAccessCaseModule } from "@/lib/auth/permissions";
import { forbidden } from "@/lib/http";

type CaseWorkspaceAccessOptions = {
  includeHidden?: boolean;
};

export async function requireCaseModuleApi(headers: Headers) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  if (!canAccessCaseModule(authResult.user)) {
    return { user: null, response: forbidden() };
  }

  return authResult;
}

async function loadCaseWorkspaceAccess(
  headers: Headers,
  workspaceId: string,
  options?: CaseWorkspaceAccessOptions
) {
  const authResult = await requireAuthenticatedApi(headers);
  if (authResult.response || !authResult.user) {
    return authResult;
  }

  if (!canAccessCaseModule(authResult.user)) {
    return { user: null, response: forbidden() };
  }

  const access = await getCaseWorkspaceAccessForUser(workspaceId, authResult.user.id, options);
  if (!access) {
    return {
      user: null,
      response: NextResponse.json({ error: "Workspace not found" }, { status: 404 }),
    };
  }

  return { user: authResult.user, workspaceAccess: access, response: null };
}

export async function requireCaseWorkspaceReadAccess(headers: Headers, workspaceId: string) {
  const result = await loadCaseWorkspaceAccess(headers, workspaceId);
  if (result.response || !result.user || !result.workspaceAccess) {
    return result;
  }

  return result;
}

export async function requireCaseWorkspaceContentCreateAccess(
  headers: Headers,
  workspaceId: string
) {
  const result = await loadCaseWorkspaceAccess(headers, workspaceId);
  if (result.response || !result.user || !result.workspaceAccess) {
    return result;
  }

  if (!result.workspaceAccess.canCreateContent) {
    return { user: null, response: forbidden() };
  }

  if (!result.workspaceAccess.workspace.isActive) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Workspace is archived and cannot be modified" },
        { status: 409 }
      ),
    };
  }

  return result;
}

export async function requireCaseWorkspaceManageAccess(headers: Headers, workspaceId: string) {
  const result = await loadCaseWorkspaceAccess(headers, workspaceId, { includeHidden: true });
  if (result.response || !result.user || !result.workspaceAccess) {
    return result;
  }

  if (!result.workspaceAccess.canManageWorkspace) {
    return { user: null, response: forbidden() };
  }

  return result;
}

export async function requireCaseWorkspaceMemberAccess(headers: Headers, workspaceId: string) {
  const result = await loadCaseWorkspaceAccess(headers, workspaceId, { includeHidden: true });
  if (result.response || !result.user || !result.workspaceAccess) {
    return result;
  }

  if (!result.workspaceAccess.canManageMembers) {
    return { user: null, response: forbidden() };
  }

  return result;
}
