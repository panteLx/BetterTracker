import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { requireTrackerWriteAccess } from "@/lib/auth/guards";
import { notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";

async function getCategory(id: string) {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const category = await getCategory(id);
  if (!category) return notFound("Category not found");

  const access = await requireTrackerWriteAccess(request.headers, category.trackerId);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      name?: string;
      type?: "expense" | "income" | "transfer";
      color?: string;
      isActive?: boolean;
    }>(request);

    const [updated] = await db
      .update(categories)
      .set({
        name: body.name?.trim(),
        type: body.type,
        color: body.color,
        isActive: body.isActive,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    return ok({ item: updated });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const category = await getCategory(id);
  if (!category) return notFound("Category not found");
  const access = await requireTrackerWriteAccess(request.headers, category.trackerId);
  if (access.response) return access.response;

  try {
    await db.delete(categories).where(eq(categories.id, id));
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
