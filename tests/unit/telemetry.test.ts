import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TelemetryEvent } from "@/types";

// In-memory shim mimicking Dexie's where().below(...).delete() chain.
const telemetryStore = new Map<string, TelemetryEvent>();

vi.mock("@/lib/db", () => {
  const where = (key: string) => ({
    equals: (value: string) => ({
      and: (predicate: (e: TelemetryEvent) => boolean) => ({
        toArray: async () =>
          Array.from(telemetryStore.values()).filter(
            (e) =>
              (e as unknown as Record<string, string>)[key] === value &&
              predicate(e)
          ),
      }),
    }),
    below: (cutoff: number) => ({
      delete: async () => {
        let n = 0;
        for (const [id, e] of telemetryStore) {
          if ((e as unknown as Record<string, number>)[key] < cutoff) {
            telemetryStore.delete(id);
            n++;
          }
        }
        return n;
      },
    }),
  });

  const whereByProfile = (filter: { profileId: string }) => ({
    toArray: async () =>
      Array.from(telemetryStore.values()).filter(
        (e) => e.profileId === filter.profileId
      ),
    delete: async () => {
      let n = 0;
      for (const [id, e] of telemetryStore) {
        if (e.profileId === filter.profileId) {
          telemetryStore.delete(id);
          n++;
        }
      }
      return n;
    },
  });

  return {
    db: {
      telemetry: {
        put: async (e: TelemetryEvent) => {
          telemetryStore.set(e.id, e);
        },
        where: (arg: string | { profileId: string }) => {
          if (typeof arg === "string") return where(arg);
          return whereByProfile(arg);
        },
      },
    },
  };
});

const {
  recordEvent,
  pruneOldEvents,
  getEventsForProfile,
  clearTelemetryForProfile,
  TELEMETRY_RETENTION_MS,
} = await import("@/lib/telemetry");

describe("telemetry", () => {
  beforeEach(() => {
    telemetryStore.clear();
  });

  it("recordEvent writes a row with id + ts auto-filled", async () => {
    const result = await recordEvent({
      profileId: "p1",
      kind: "mission_start",
      missionId: "f01_build_h_atom",
      worldId: "foundations",
      ageBand: "8-10",
    });
    expect(result.id).toBeTruthy();
    expect(result.ts).toBeGreaterThan(0);
    expect(telemetryStore.size).toBe(1);
  });

  it("preserves variant-specific fields (mission_complete payload)", async () => {
    const result = await recordEvent({
      profileId: "p1",
      kind: "mission_complete",
      missionId: "f01_build_h_atom",
      worldId: "foundations",
      ageBand: "8-10",
      stars: 3,
      hintsUsed: 0,
      attempts: 1,
      durationMs: 12345,
    });
    if (result.kind !== "mission_complete") throw new Error("kind drift");
    expect(result.stars).toBe(3);
    expect(result.durationMs).toBe(12345);
  });

  it("getEventsForProfile returns newest first, scoped by profile", async () => {
    // Manually seed three events with monotonic ids.
    for (let i = 0; i < 3; i++) {
      const e: TelemetryEvent = {
        id: `e${i}`,
        profileId: "p1",
        kind: "mission_start",
        missionId: `m${i}`,
        worldId: "foundations",
        ageBand: "8-10",
        ts: 1000 + i * 100,
      };
      telemetryStore.set(e.id, e);
    }
    // And a row for a different profile.
    telemetryStore.set("other", {
      id: "other",
      profileId: "p2",
      kind: "mission_start",
      missionId: "m9",
      worldId: "foundations",
      ageBand: "8-10",
      ts: 2000,
    });

    const events = await getEventsForProfile("p1");
    expect(events.map((e) => e.id)).toEqual(["e2", "e1", "e0"]);
  });

  it("pruneOldEvents drops rows older than the retention cutoff", async () => {
    const now = 10_000_000_000_000;
    const oldTs = now - TELEMETRY_RETENTION_MS - 1;
    const newTs = now - 1000;
    telemetryStore.set("old", {
      id: "old",
      profileId: "p1",
      kind: "mission_start",
      missionId: "m",
      worldId: "foundations",
      ageBand: "8-10",
      ts: oldTs,
    });
    telemetryStore.set("new", {
      id: "new",
      profileId: "p1",
      kind: "mission_start",
      missionId: "m",
      worldId: "foundations",
      ageBand: "8-10",
      ts: newTs,
    });

    // Reset throttle by deleting the old prune marker — pruneOldEvents
    // is throttled module-internally so we pass a `now` hint and
    // assume first call after import isn't throttled.
    const deleted = await pruneOldEvents(now);
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(telemetryStore.has("old")).toBe(false);
    expect(telemetryStore.has("new")).toBe(true);
  });

  it("clearTelemetryForProfile wipes the profile's events only", async () => {
    telemetryStore.set("a", {
      id: "a",
      profileId: "p1",
      kind: "mission_start",
      missionId: "m",
      worldId: "foundations",
      ageBand: "8-10",
      ts: 1,
    });
    telemetryStore.set("b", {
      id: "b",
      profileId: "p2",
      kind: "mission_start",
      missionId: "m",
      worldId: "foundations",
      ageBand: "8-10",
      ts: 1,
    });
    await clearTelemetryForProfile("p1");
    expect(telemetryStore.has("a")).toBe(false);
    expect(telemetryStore.has("b")).toBe(true);
  });
});
