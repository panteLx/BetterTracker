import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getTrackerById(trackerId: string) {
  const rows = await db.select().from(trackers).where(eq(trackers.id, trackerId)).limit(1);
  return rows[0] ?? null;
}

export async function isTrackerActive(trackerId: string) {
  const tracker = await getTrackerById(trackerId);
  return tracker?.isActive ?? false;
}
