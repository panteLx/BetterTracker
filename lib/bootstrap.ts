import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings, trackerMembers, trackers } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/services/admin-settings-service";

export async function ensureBootstrapForUser(userId: string) {
  const trackerCount = await db.select({ value: count() }).from(trackers);

  if ((trackerCount[0]?.value ?? 0) > 0) {
    const memberships = await db
      .select()
      .from(trackerMembers)
      .where(eq(trackerMembers.userId, userId));

    if (memberships.length === 0) {
      const existingTrackers = await db
        .select()
        .from(trackers)
        .orderBy(asc(trackers.sortOrder));

      for (const tracker of existingTrackers) {
        await db.insert(trackerMembers).values({
          trackerId: tracker.id,
          userId,
          permission: "owner",
        });
      }
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await db
      .select({ id: appSettings.id })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (!existing[0]) {
      await db.insert(appSettings).values({
        key,
        valueJson: JSON.stringify(value),
        updatedByUserId: userId,
      });
    }
  }
}
