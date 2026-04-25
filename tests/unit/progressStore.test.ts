import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MissionProgress, PlayerProfile, PlayerSettings } from "@/types";

// In-memory shims so we don't need IndexedDB.
const profilesStore = new Map<string, PlayerProfile>();
const progressStore = new Map<string, MissionProgress>();
const settingsStore = new Map<string, PlayerSettings>();

vi.mock("@/lib/db", () => ({
  getProfiles: vi.fn(async () => Array.from(profilesStore.values())),
  createProfile: vi.fn(async (p: PlayerProfile) => {
    profilesStore.set(p.id, p);
  }),
  deleteProfile: vi.fn(async (id: string) => {
    profilesStore.delete(id);
  }),
  getProgressForProfile: vi.fn(async (profileId: string) =>
    Array.from(progressStore.values()).filter((p) => p.profileId === profileId)
  ),
  saveMissionProgress: vi.fn(async (p: MissionProgress) => {
    progressStore.set(`${p.profileId}:${p.missionId}`, p);
  }),
  getSettings: vi.fn(async (profileId: string) => settingsStore.get(profileId) ?? null),
  saveSettings: vi.fn(async (s: PlayerSettings) => {
    settingsStore.set(s.profileId, s);
  }),
}));

vi.mock("@/lib/audio", () => ({
  audio: {
    setEnabled: vi.fn(),
    setReducedMotion: vi.fn(),
  },
}));

// Import AFTER mocks are registered so the store wires up to the shims.
const { useProgressStore } = await import("@/store/progressStore");

const profileA: PlayerProfile = {
  id: "p1",
  name: "Alice",
  avatar: "default",
  createdAt: 1,
  ageBand: "8-10",
};

const profileB: PlayerProfile = {
  id: "p2",
  name: "Bob",
  avatar: "default",
  createdAt: 2,
  ageBand: "11-14",
};

function progress(missionId: string, stars: number, profileId = "p1"): MissionProgress {
  return {
    profileId,
    missionId,
    stars,
    completedAt: 1000,
    attempts: 1,
    bestIndependenceScore: 1.0,
  };
}

describe("progressStore", () => {
  beforeEach(() => {
    profilesStore.clear();
    progressStore.clear();
    settingsStore.clear();
    useProgressStore.setState({
      profiles: [],
      currentProfile: null,
      progress: [],
      settings: null,
      adultSession: null,
    });
  });

  it("addProfile persists and refreshes the profile list", async () => {
    await useProgressStore.getState().addProfile(profileA);
    expect(useProgressStore.getState().profiles).toEqual([profileA]);
  });

  it("removeProfile clears currentProfile when it removes the active profile", async () => {
    await useProgressStore.getState().addProfile(profileA);
    await useProgressStore.getState().addProfile(profileB);
    useProgressStore.setState({
      currentProfile: profileA,
      progress: [progress("m1", 2)],
      settings: { profileId: "p1", reducedMotion: false, soundEnabled: true, highContrast: false, language: "en" },
    });

    await useProgressStore.getState().removeProfile("p1");

    const s = useProgressStore.getState();
    expect(s.currentProfile).toBeNull();
    expect(s.progress).toEqual([]);
    expect(s.settings).toBeNull();
    expect(s.profiles.map((p) => p.id)).toEqual(["p2"]);
  });

  it("removeProfile keeps currentProfile when removing a different profile", async () => {
    await useProgressStore.getState().addProfile(profileA);
    await useProgressStore.getState().addProfile(profileB);
    useProgressStore.setState({ currentProfile: profileA });

    await useProgressStore.getState().removeProfile("p2");

    expect(useProgressStore.getState().currentProfile).toEqual(profileA);
  });

  it("loadSettings creates defaults on first load and persists them", async () => {
    await useProgressStore.getState().loadSettings("p1");
    const s = useProgressStore.getState().settings;
    expect(s).not.toBeNull();
    expect(s?.profileId).toBe("p1");
    expect(s?.soundEnabled).toBe(true);
    expect(s?.reducedMotion).toBe(false);
    // Persisted to the shim:
    expect(settingsStore.get("p1")).toBeTruthy();
  });

  it("loadSettings re-uses existing settings when present", async () => {
    settingsStore.set("p1", {
      profileId: "p1",
      reducedMotion: true,
      soundEnabled: false,
      highContrast: true,
      language: "fr",
    });
    await useProgressStore.getState().loadSettings("p1");
    expect(useProgressStore.getState().settings?.language).toBe("fr");
    expect(useProgressStore.getState().settings?.reducedMotion).toBe(true);
  });

  it("isMissionUnlocked respects prerequisites and star requirements", () => {
    useProgressStore.setState({
      progress: [progress("m1", 2), progress("m2", 0)],
    });
    const { isMissionUnlocked } = useProgressStore.getState();

    expect(isMissionUnlocked("m3", [])).toBe(true);
    expect(isMissionUnlocked("m3", ["m1"])).toBe(true);
    // m2 was attempted but earned 0 stars — should still be locked.
    expect(isMissionUnlocked("m3", ["m2"])).toBe(false);
    // Missing entirely.
    expect(isMissionUnlocked("m3", ["m4"])).toBe(false);
    // Mixed: needs both, only one passes.
    expect(isMissionUnlocked("m3", ["m1", "m2"])).toBe(false);
  });
});
