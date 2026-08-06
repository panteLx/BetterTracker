import { db } from "@/lib/db";
import { caseWorkspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";

export async function getCaseWorkspaceById(workspaceId: string) {
  const rows = await db
    .select()
    .from(caseWorkspaces)
    .where(eq(caseWorkspaces.id, workspaceId))
    .limit(1);
  return rows[0] ?? null;
}

export type CaseWorkspaceUpdateInput = {
  name?: string;
  description?: string | null;
  color?: string;
  isActive?: boolean;
  isHidden?: boolean;
};

export function buildCaseWorkspaceUpdateValues(body: CaseWorkspaceUpdateInput) {
  return {
    name: body.name?.trim(),
    slug: body.name ? slugify(body.name) : undefined,
    description:
      body.description === undefined ? undefined : body.description?.trim() || null,
    color: body.color,
    isActive: body.isActive,
    isHidden: body.isHidden,
    updatedAt: new Date(),
  };
}
