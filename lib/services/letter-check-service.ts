import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { letterChecks, user } from "@/lib/db/schema";
import { letterCheckRangeSchema, letterCheckUpdateSchema } from "@/lib/validators/letter-check";
import { ValidationError } from "@/lib/errors";

export type LetterCheckEntry = {
  date: string;
  checkedByName: string | null;
  checkedAt: string;
};

export async function listLetterChecks(
  workspaceId: string,
  range: { from: string; to: string }
): Promise<LetterCheckEntry[]> {
  const { from, to } = letterCheckRangeSchema.parse(range);
  const rows = await db
    .select({
      date: letterChecks.date,
      checkedByName: user.name,
      checkedAt: letterChecks.createdAt,
    })
    .from(letterChecks)
    .leftJoin(user, eq(user.id, letterChecks.checkedByUserId))
    .where(
      and(
        eq(letterChecks.workspaceId, workspaceId),
        gte(letterChecks.date, from),
        lte(letterChecks.date, to)
      )
    );
  return rows.map((row) => ({ ...row, checkedAt: row.checkedAt.toISOString() }));
}

function assertWeekday(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = parsed.getUTCDay();
  if (Number.isNaN(parsed.getTime()) || day === 0 || day === 6) {
    throw new ValidationError("Date must be a weekday");
  }
}

export async function setLetterCheck(
  workspaceId: string,
  date: string,
  input: unknown,
  userId: string
) {
  const { checked } = letterCheckUpdateSchema.parse(input);
  assertWeekday(date);

  if (checked) {
    await db
      .insert(letterChecks)
      .values({ workspaceId, date, checkedByUserId: userId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(letterChecks)
      .where(and(eq(letterChecks.workspaceId, workspaceId), eq(letterChecks.date, date)));
  }
  return { date, checked };
}
