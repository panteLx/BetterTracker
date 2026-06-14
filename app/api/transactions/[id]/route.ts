import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import { requireTrackerWriteAccess } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { parseAmountToCents } from "@/lib/utils";

async function getTransaction(id: string) {
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const existing = await getTransaction(id);
  if (!existing) return notFound("Transaction not found");

  const access = await requireTrackerWriteAccess(request.headers, existing.trackerId);
  if (access.response) return access.response;

  try {
    const body = await parseRequestJson<{
      accountName?: string;
      date?: string;
      amount?: string | number;
      direction?: "expense" | "income";
      categoryId?: string | null;
      payeeId?: string | null;
      customPayeeName?: string | null;
      notes?: string | null;
    }>(request);

    const nextCategoryId =
      body.categoryId === undefined ? existing.categoryId : body.categoryId;

    if (!nextCategoryId) {
      throw new Error("Transaction category is required");
    }

    const [category] = await db
      .select({
        id: categories.id,
        type: categories.type,
      })
      .from(categories)
      .where(
        and(
          eq(categories.id, nextCategoryId),
          eq(categories.trackerId, existing.trackerId)
        )
      )
      .limit(1);

    if (!category) {
      throw new Error("Transaction category is required");
    }

    const nextDirection = body.direction ?? existing.direction;
    if (category.type !== nextDirection && category.type !== "transfer") {
      throw new Error("Transaction category does not match the selected direction");
    }

    const [updated] = await db
      .update(transactions)
      .set({
        accountName: body.accountName ?? existing.accountName,
        date: body.date ?? existing.date,
        amountCents:
          body.amount !== undefined
            ? parseAmountToCents(body.amount) ?? existing.amountCents
            : existing.amountCents,
        direction: nextDirection,
        categoryId: nextCategoryId,
        payeeId: body.payeeId === undefined ? existing.payeeId : body.payeeId,
        customPayeeName:
          body.customPayeeName === undefined
            ? existing.customPayeeName
            : body.customPayeeName,
        notes: body.notes === undefined ? existing.notes : body.notes,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "transaction_updated",
      resourceType: "transaction",
      resourceId: id,
      metadata: body,
      ...(await getRequestAuditContext()),
    });

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
  const existing = await getTransaction(id);
  if (!existing) return notFound("Transaction not found");
  const access = await requireTrackerWriteAccess(request.headers, existing.trackerId);
  if (access.response) return access.response;

  try {
    await db.delete(transactions).where(eq(transactions.id, id));
    await logAuditEvent({
      actorUserId: access.user!.id,
      action: "transaction_deleted",
      resourceType: "transaction",
      resourceId: id,
      metadata: { trackerId: existing.trackerId },
      ...(await getRequestAuditContext()),
    });
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
