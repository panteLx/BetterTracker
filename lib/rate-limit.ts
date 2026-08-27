import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  // Map iterates in insertion order, so this drops the oldest keys first.
  const overflow = buckets.size - MAX_BUCKETS;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++removed >= overflow) break;
  }
}

/**
 * In-process fixed-window limiter for the handful of endpoints expensive
 * enough to hurt a single-writer SQLite database (PDF rendering, CSV import,
 * statistics aggregates, the public transactions feed).
 *
 * Keys must not be spoofable: for authenticated routes key on the user id.
 * The store is per-process, so limits reset on deploy and are per-replica —
 * acceptable for the single-container default this product ships with.
 *
 * Returns `null` when the caller is within budget, or a 429 response to return.
 */
export function checkRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  bucket.count += 1;
  return null;
}
