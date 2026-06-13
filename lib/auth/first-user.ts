import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit-log";

export async function handleFirstUserPromotion(userId: string) {
  const users = await db.select({ id: user.id }).from(user).limit(2);
  if (users.length === 1 && users[0].id === userId) {
    await db.update(user).set({ role: "superadmin" }).where(eq(user.id, userId));
    await logAuditEvent({
      actorUserId: userId,
      action: "user_promoted_to_superadmin",
      resourceType: "user",
      resourceId: userId,
      metadata: { reason: "first_user_registration" },
    });
    return true;
  }

  return false;
}
