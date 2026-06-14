import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/services/admin-settings-service";

export async function ensureBootstrapForUser(userId: string) {
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
