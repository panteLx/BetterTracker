import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payees } from "@/lib/db/schema";
import { requireTrackerReferenceManageAccess } from "@/lib/auth/guards";
import { mapServiceError, notFound, ok, serverError } from "@/lib/http";
import { parseRequestJson } from "@/lib/http";
import { payeeUpdateSchema } from "@/lib/validators/payee";

async function getPayee(id: string) {
  const rows = await db.select().from(payees).where(eq(payees.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const payee = await getPayee(id);
  if (!payee) return notFound("Payee not found");
  const access = await requireTrackerReferenceManageAccess(request.headers, payee.trackerId);
  if (access.response) return access.response;

  try {
    const rawBody = await parseRequestJson<unknown>(request);
    const body = payeeUpdateSchema.parse(rawBody);

    const [updated] = await db
      .update(payees)
      .set({
        name: body.name,
        notes: body.notes === undefined ? undefined : body.notes || null,
        isActive: body.isActive,
        updatedAt: new Date(),
      })
      .where(eq(payees.id, id))
      .returning();

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
  const payee = await getPayee(id);
  if (!payee) return notFound("Payee not found");
  const access = await requireTrackerReferenceManageAccess(request.headers, payee.trackerId);
  if (access.response) return access.response;

  try {
    await db.delete(payees).where(eq(payees.id, id));
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
