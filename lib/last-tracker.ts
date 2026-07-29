/**
 * Remembers which tracker you last worked in, so the floating quick-add opens
 * on that one instead of on whichever tracker happens to sort first. Stored per
 * device alongside the other look-and-feel preferences.
 */

import { writeLocalStorageValue } from "@/hooks/use-local-storage-value";

export const LAST_TRACKER_KEY = "bettertracker.lastTracker";

export function rememberTracker(trackerId: string) {
  if (!trackerId) return;

  writeLocalStorageValue(LAST_TRACKER_KEY, trackerId);
}
