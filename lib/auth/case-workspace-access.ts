import { and, asc, eq, like, notInArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { caseWorkspaceMembers, caseWorkspaces, user } from "@/lib/db/schema";
import {
  canCreateTrackerContent as canCreateWorkspaceContent,
  canEditOwnTrackerContent as canEditOwnWorkspaceContent,
  canManageTracker as canManageWorkspace,
  canManageTrackerMembers as canManageWorkspaceMembers,
  canManageTrackerReferenceData as canManageWorkspaceReferenceData,
  canReadTracker as canReadWorkspace,
  type TrackerPermission,
} from "@/lib/auth/permissions";

const MIN_CANDIDATE_QUERY_LENGTH = 3;

export type CaseWorkspacePermission = TrackerPermission;

const workspaceSelect = {
  id: caseWorkspaces.id,
  name: caseWorkspaces.name,
  slug: caseWorkspaces.slug,
  description: caseWorkspaces.description,
  color: caseWorkspaces.color,
  isActive: caseWorkspaces.isActive,
  isHidden: caseWorkspaces.isHidden,
  sortOrder: caseWorkspaces.sortOrder,
  createdAt: caseWorkspaces.createdAt,
  updatedAt: caseWorkspaces.updatedAt,
};

export type CaseWorkspaceListItem = typeof caseWorkspaces.$inferSelect & {
  permission: CaseWorkspacePermission;
};

export type CaseWorkspaceAccess = {
  workspace: typeof caseWorkspaces.$inferSelect;
  permission: CaseWorkspacePermission;
  canRead: boolean;
  canCreateContent: boolean;
  canManageWorkspace: boolean;
  canManageMembers: boolean;
  canManageReferenceData: boolean;
  canEditOwnContent: boolean;
};

function toCaseWorkspaceAccess(
  workspace: typeof caseWorkspaces.$inferSelect,
  permission: CaseWorkspacePermission
): CaseWorkspaceAccess {
  return {
    workspace,
    permission,
    canRead: canReadWorkspace(permission),
    canCreateContent: canCreateWorkspaceContent(permission),
    canManageWorkspace: canManageWorkspace(permission),
    canManageMembers: canManageWorkspaceMembers(permission),
    canManageReferenceData: canManageWorkspaceReferenceData(permission),
    canEditOwnContent: canEditOwnWorkspaceContent(permission),
  };
}

export async function listCaseWorkspacesForUser(userId: string) {
  const rows = await db
    .select({
      ...workspaceSelect,
      permission: caseWorkspaceMembers.permission,
    })
    .from(caseWorkspaces)
    .innerJoin(
      caseWorkspaceMembers,
      and(
        eq(caseWorkspaceMembers.workspaceId, caseWorkspaces.id),
        eq(caseWorkspaceMembers.userId, userId)
      )
    )
    .where(eq(caseWorkspaces.isHidden, false))
    .orderBy(asc(caseWorkspaces.sortOrder), asc(caseWorkspaces.name));

  return rows as CaseWorkspaceListItem[];
}

export async function getCaseWorkspaceAccessForUser(
  workspaceId: string,
  userId: string,
  options?: { includeHidden?: boolean }
) {
  const rows = await db
    .select({
      ...workspaceSelect,
      permission: caseWorkspaceMembers.permission,
    })
    .from(caseWorkspaces)
    .innerJoin(
      caseWorkspaceMembers,
      and(
        eq(caseWorkspaces.id, caseWorkspaceMembers.workspaceId),
        eq(caseWorkspaceMembers.userId, userId)
      )
    )
    .where(eq(caseWorkspaces.id, workspaceId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  if (row.isHidden && !options?.includeHidden) {
    return null;
  }

  return toCaseWorkspaceAccess(row, row.permission as CaseWorkspacePermission);
}

export async function listCaseWorkspaceMembers(workspaceId: string) {
  return db
    .select({
      id: caseWorkspaceMembers.id,
      workspaceId: caseWorkspaceMembers.workspaceId,
      userId: caseWorkspaceMembers.userId,
      permission: caseWorkspaceMembers.permission,
      createdAt: caseWorkspaceMembers.createdAt,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    })
    .from(caseWorkspaceMembers)
    .innerJoin(user, eq(user.id, caseWorkspaceMembers.userId))
    .where(eq(caseWorkspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(user.name), asc(user.email));
}

export async function getCaseWorkspaceMember(memberId: string) {
  const rows = await db
    .select()
    .from(caseWorkspaceMembers)
    .where(eq(caseWorkspaceMembers.id, memberId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCaseWorkspaceMemberByUser(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(caseWorkspaceMembers)
    .where(
      and(
        eq(caseWorkspaceMembers.workspaceId, workspaceId),
        eq(caseWorkspaceMembers.userId, userId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listCaseWorkspaceMemberCandidates(workspaceId: string, query: string) {
  const term = query.trim();
  // An unanchored substring search over the whole user table doubles as a
  // directory dump, so require enough of a term that the caller already knows
  // who they are looking for, and only match an email address from its start.
  if (term.length < MIN_CANDIDATE_QUERY_LENGTH) {
    return [];
  }

  const existingMembers = await db
    .select({ userId: caseWorkspaceMembers.userId })
    .from(caseWorkspaceMembers)
    .where(eq(caseWorkspaceMembers.workspaceId, workspaceId));

  const excludedUserIds = existingMembers.map((item) => item.userId);
  const conditions = [
    or(like(user.name, `%${term}%`), like(user.email, `${term}%`))!,
  ];

  if (excludedUserIds.length > 0) {
    conditions.push(notInArray(user.id, excludedUserIds));
  }

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(and(...conditions))
    .orderBy(asc(user.name), asc(user.email))
    .limit(20);
}
