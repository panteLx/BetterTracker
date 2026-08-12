import { and, eq } from "drizzle-orm";
import { canMutateTrackerResource } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { categories, payees, transactions } from "@/lib/db/schema";
import { requireTrackerReadAccess } from "@/lib/auth/guards";
import { getRequestAuditContext, logAuditEvent } from "@/lib/audit-log";
import { conflict, forbidden, mapServiceError, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { parseAmountToCents, parseWeightToGrams } from "@/lib/utils";
import { ValidationError } from "@/lib/errors";
import { transactionUpdateSchema } from "@/lib/validators/transaction";

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

  const access = await requireTrackerReadAccess(request.headers, existing.trackerId);
  if (access.response) return access.response;
  if (
    !canMutateTrackerResource(
      access.trackerAccess!.permission,
      access.user!.id,
      existing.createdByUserId
    )
  ) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }

  try {
    const rawBody = await parseRequestJson<unknown>(request);
    const body = transactionUpdateSchema.parse(rawBody);

    const nextCategoryId =
      body.categoryId === undefined ? existing.categoryId : body.categoryId;

    if (!nextCategoryId) {
      throw new ValidationError("Transaction category is required");
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
      throw new ValidationError("Transaction category is required");
    }

    const nextDirection = body.direction ?? existing.direction;
    if (category.type !== nextDirection && category.type !== "transfer") {
      throw new ValidationError("Transaction category does not match the selected direction");
    }

    const nextPayeeId = body.payeeId === undefined ? existing.payeeId : body.payeeId;
    let nextWeightGrams: number | null;
    if (body.weightKg === undefined) {
      nextWeightGrams = existing.weightGrams;
    } else if (body.weightKg === null) {
      nextWeightGrams = null;
    } else {
      nextWeightGrams = parseWeightToGrams(body.weightKg);
    }

    if (access.trackerAccess!.tracker.weightTrackingEnabled && nextPayeeId) {
      const [nextPayee] = await db
        .select({ trackWeight: payees.trackWeight })
        .from(payees)
        .where(eq(payees.id, nextPayeeId))
        .limit(1);

      if (nextPayee?.trackWeight) {
        if (nextWeightGrams === null || nextWeightGrams <= 0) {
          throw new ValidationError("Weight in kg is required for this payee");
        }
      } else {
        nextWeightGrams = null;
      }
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
        weightGrams: nextWeightGrams,
        direction: nextDirection,
        categoryId: nextCategoryId,
        payeeId: nextPayeeId,
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
    return mapServiceError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const existing = await getTransaction(id);
  if (!existing) return notFound("Transaction not found");
  const access = await requireTrackerReadAccess(request.headers, existing.trackerId);
  if (access.response) return access.response;
  if (
    !canMutateTrackerResource(
      access.trackerAccess!.permission,
      access.user!.id,
      existing.createdByUserId
    )
  ) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }

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
