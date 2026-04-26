// Telemetry — privacy-reviewed event pipeline. Local Dexie buffer,
// rolling 90-day retention. No free-text fields, no third-party SDKs.
// See compliance/posture.md for the data-handling decisions.

import type { TelemetryEvent, TelemetryEventInput } from "@/types";
import { db } from "./db";

// Default retention window. Compliance posture lists this as 90 days
// with the option to tighten in review. The parent dashboard exposes a
// clear-now button regardless; this constant just controls the
// background eviction.
export const TELEMETRY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// Pruning is best-effort and runs at most once per session per call.
// Throttled state lives in module scope; not exported.
let lastPruneAt = 0;
const PRUNE_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Drop events older than the retention window. Safe to call frequently;
 * internally throttled so a flurry of recordEvent calls doesn't hammer
 * the index. Returns the number of deleted rows.
 */
export async function pruneOldEvents(now: number = Date.now()): Promise<number> {
  if (now - lastPruneAt < PRUNE_THROTTLE_MS) return 0;
  lastPruneAt = now;
  const cutoff = now - TELEMETRY_RETENTION_MS;
  return db.telemetry.where("ts").below(cutoff).delete();
}

/**
 * Record a single telemetry event. Caller passes everything except
 * `id` and `ts`; this function fills those in. The TelemetryEventInput
 * type preserves the discriminated-union shape so each variant's
 * required fields are checked independently.
 */
export async function recordEvent(
  event: TelemetryEventInput
): Promise<TelemetryEvent> {
  const full = {
    ...event,
    id: crypto.randomUUID(),
    ts: Date.now(),
  } as TelemetryEvent;
  await db.telemetry.put(full);
  // Run pruning fire-and-forget; we don't want recordEvent to block on
  // it. Errors here are non-fatal (worst case: stale rows live longer).
  void pruneOldEvents().catch(() => {});
  return full;
}

/**
 * Read events for a profile, newest first. Optionally restrict to a
 * recency window (e.g. last 7 days for the dashboard summary).
 */
export async function getEventsForProfile(
  profileId: string,
  sinceTs?: number
): Promise<TelemetryEvent[]> {
  let query = db.telemetry.where({ profileId });
  if (sinceTs !== undefined) {
    query = db.telemetry
      .where("profileId")
      .equals(profileId)
      .and((e) => e.ts >= sinceTs);
  }
  const rows = await query.toArray();
  return rows.sort((a, b) => b.ts - a.ts);
}

/**
 * Clear all telemetry for a profile. Backs the parent-dashboard
 * "clear telemetry" action without wiping the rest of the profile.
 */
export async function clearTelemetryForProfile(
  profileId: string
): Promise<number> {
  return db.telemetry.where({ profileId }).delete();
}
