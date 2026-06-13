import { createTransactionFromSchedule } from "@/lib/services/schedule-service";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireTrackerWriteAccess } from "@/lib/auth/guards";
import { notFound, ok, serverError } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const rows = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
  const schedule = rows[0];
  if (!schedule) return notFound("Schedule not found");
  const access = await requireTrackerWriteAccess(request.headers, schedule.trackerId);
  if (access.response) return access.response;

  try {
    const item = await createTransactionFromSchedule(id, access.user!.id);
    return ok({ item });
  } catch (error) {
    return serverError(error);
  }
}
