import { eq } from "drizzle-orm";
import { canMutateTrackerResource } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { requireTrackerReadAccess } from "@/lib/auth/guards";
import { conflict, forbidden, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { parseAmountToCents } from "@/lib/utils";

async function getSchedule(id: string) {
  const rows = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const schedule = await getSchedule(id);
  if (!schedule) return notFound("Schedule not found");
  const access = await requireTrackerReadAccess(request.headers, schedule.trackerId);
  if (access.response) return access.response;
  if (
    !canMutateTrackerResource(
      access.trackerAccess!.permission,
      access.user!.id,
      schedule.createdByUserId
    )
  ) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }

  try {
    const body = await parseRequestJson<{
      name?: string;
      amount?: string | number;
      direction?: "expense" | "income";
      categoryId?: string | null;
      payeeId?: string | null;
      customPayeeName?: string | null;
      notesTemplate?: string | null;
      frequency?: "monthly" | "yearly" | "custom_days";
      intervalValue?: number;
      nextDueDate?: string;
      isActive?: boolean;
      autoCreateDisabled?: boolean;
    }>(request);

    const [updated] = await db
      .update(schedules)
      .set({
        name: body.name ?? schedule.name,
        amountCents:
          body.amount !== undefined
            ? parseAmountToCents(body.amount) ?? schedule.amountCents
            : schedule.amountCents,
        direction: body.direction ?? schedule.direction,
        categoryId: body.categoryId === undefined ? schedule.categoryId : body.categoryId,
        payeeId: body.payeeId === undefined ? schedule.payeeId : body.payeeId,
        customPayeeName:
          body.customPayeeName === undefined
            ? schedule.customPayeeName
            : body.customPayeeName,
        notesTemplate:
          body.notesTemplate === undefined
            ? schedule.notesTemplate
            : body.notesTemplate,
        frequency: body.frequency ?? schedule.frequency,
        intervalValue: body.intervalValue ?? schedule.intervalValue,
        nextDueDate: body.nextDueDate ?? schedule.nextDueDate,
        isActive: body.isActive ?? schedule.isActive,
        autoCreateDisabled:
          body.autoCreateDisabled ?? schedule.autoCreateDisabled,
        updatedAt: new Date(),
      })
      .where(eq(schedules.id, id))
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
  const schedule = await getSchedule(id);
  if (!schedule) return notFound("Schedule not found");
  const access = await requireTrackerReadAccess(request.headers, schedule.trackerId);
  if (access.response) return access.response;
  if (
    !canMutateTrackerResource(
      access.trackerAccess!.permission,
      access.user!.id,
      schedule.createdByUserId
    )
  ) {
    return forbidden();
  }
  if (!access.trackerAccess!.tracker.isActive) {
    return conflict("Tracker is archived and cannot be modified");
  }

  try {
    await db.delete(schedules).where(eq(schedules.id, id));
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
