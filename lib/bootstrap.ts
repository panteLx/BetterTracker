import { db } from "@/lib/db";
import { appSettings, categories, trackerMembers, trackers } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/services/admin-settings-service";
import { asc, count, eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";

const TRACKER_SEEDS = [
  {
    name: "Coffee",
    color: "#92400e",
  },
  {
    name: "Money",
    color: "#0f766e",
  },
];

const CATEGORY_SEEDS = [
  { name: "Lebensmittel", type: "expense", color: "#475569" },
  { name: "Kaffee", type: "expense", color: "#92400e" },
  { name: "Abo", type: "expense", color: "#7c3aed" },
  { name: "Haushalt", type: "expense", color: "#2563eb" },
  { name: "Freizeit", type: "expense", color: "#db2777" },
  { name: "Einnahmen", type: "income", color: "#059669" },
  { name: "Rückerstattung", type: "income", color: "#16a34a" },
] as const;

export async function ensureBootstrapForUser(userId: string) {
  const trackerCount = await db.select({ value: count() }).from(trackers);
  if ((trackerCount[0]?.value ?? 0) === 0) {
    for (const [index, tracker] of TRACKER_SEEDS.entries()) {
      const [createdTracker] = await db
        .insert(trackers)
        .values({
          name: tracker.name,
          slug: slugify(tracker.name),
          color: tracker.color,
          sortOrder: index,
        })
        .returning();

      await db.insert(trackerMembers).values({
        trackerId: createdTracker.id,
        userId,
        permission: "owner",
      });

      await db.insert(categories).values(
        CATEGORY_SEEDS.map((category, categoryIndex) => ({
          trackerId: createdTracker.id,
          name: category.name,
          type: category.type,
          color: category.color,
          sortOrder: categoryIndex,
        }))
      );
    }
  } else {
    const memberships = await db
      .select()
      .from(trackerMembers)
      .where(eq(trackerMembers.userId, userId));

    if (memberships.length === 0) {
      const existingTrackers = await db.select().from(trackers).orderBy(asc(trackers.sortOrder));
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
