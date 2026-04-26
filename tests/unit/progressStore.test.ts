import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BadgeAward,
  Discovery,
  MasteryCheckResult,
  MissionProgress,
  PlayerProfile,
  PlayerSettings,
} from "@/types";

// In-memory shims so we don't need IndexedDB.
const profilesStore = new Map<string, PlayerProfile>();
const progressStore = new Map<string, MissionProgress>();
const settingsStore = new Map<string, PlayerSettings>();
const discoveriesStore = new Map<string, Discovery>();
const badgesStore = new Map<string, BadgeAward>();
const masteryStore = new Map<string, MasteryCheckResult>();

vi.mock("@/lib/db", () => ({
  getProfiles: vi.fn(async () => Array.from(profilesStore.values())),
  createProfile: vi.fn(async (p: PlayerProfile) => {
    profilesStore.set(p.id, p);
  }),
  updateProfile: vi.fn(async (p: PlayerProfile) => {
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
  getDiscoveries: vi.fn(async (profileId: string) =>
    Array.from(discoveriesStore.values())
      .filter((d) => d.profileId === profileId)
      .sort((a, b) => b.createdAt - a.createdAt)
  ),
  addDiscovery: vi.fn(async (d: Discovery) => {
    discoveriesStore.set(d.id, d);
  }),
  hasDiscovery: vi.fn(async (profileId: string, kind: string, refId: string) =>
    Array.from(discoveriesStore.values()).some(
      (d) => d.profileId === profileId && d.kind === kind && d.refId === refId
    )
  ),
  getBadgeAwards: vi.fn(async (profileId: string) =>
    Array.from(badgesStore.values()).filter((b) => b.profileId === profileId)
  ),
  awardBadge: vi.fn(async (a: BadgeAward) => {
    badgesStore.set(`${a.profileId}:${a.badgeId}`, a);
  }),
  getMasteryResults: vi.fn(async (profileId: string) =>
    Array.from(masteryStore.values()).filter((r) => r.profileId === profileId)
  ),
  saveMasteryResult: vi.fn(async (r: MasteryCheckResult) => {
    masteryStore.set(`${r.profileId}:${r.worldId}:${r.phase}`, r);
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
    discoveriesStore.clear();
    badgesStore.clear();
    masteryStore.clear();
    window.localStorage.clear();
    useProgressStore.setState({
      profiles: [],
      currentProfile: null,
      progress: [],
      settings: null,
      adultSession: null,
      discoveries: [],
      badges: [],
      masteryResults: [],
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

  it("setCurrentProfile persists the selected id to localStorage", async () => {
    await useProgressStore.getState().addProfile(profileA);
    useProgressStore.getState().setCurrentProfile(profileA);
    expect(window.localStorage.getItem("sparklab_selected_profile")).toBe(
      "p1"
    );
    useProgressStore.getState().setCurrentProfile(null);
    expect(window.localStorage.getItem("sparklab_selected_profile")).toBeNull();
  });

  it("loadProfiles rehydrates currentProfile from a saved id", async () => {
    await useProgressStore.getState().addProfile(profileA);
    await useProgressStore.getState().addProfile(profileB);
    window.localStorage.setItem("sparklab_selected_profile", "p2");

    // Simulate a fresh app boot
    useProgressStore.setState({ currentProfile: null });
    await useProgressStore.getState().loadProfiles();

    expect(useProgressStore.getState().currentProfile?.id).toBe("p2");
  });

  it("loadProfiles drops a stale saved id when its profile no longer exists", async () => {
    await useProgressStore.getState().addProfile(profileA);
    window.localStorage.setItem("sparklab_selected_profile", "ghost");

    await useProgressStore.getState().loadProfiles();

    expect(useProgressStore.getState().currentProfile).toBeNull();
    expect(window.localStorage.getItem("sparklab_selected_profile")).toBeNull();
  });

  it("addDiscoveryRecord persists and dedupes by (kind, refId)", async () => {
    await useProgressStore.getState().addProfile(profileA);
    useProgressStore.setState({ currentProfile: profileA });

    const first = await useProgressStore.getState().addDiscoveryRecord({
      profileId: "p1",
      kind: "mission-complete",
      refId: "f01_build_h_atom",
      label: "Build a Hydrogen Atom",
      explanation: "You built it!",
    });
    expect(first).not.toBeNull();
    expect(useProgressStore.getState().discoveries.length).toBe(1);

    // Same (kind, refId) — should not double-record.
    const second = await useProgressStore.getState().addDiscoveryRecord({
      profileId: "p1",
      kind: "mission-complete",
      refId: "f01_build_h_atom",
      label: "Build a Hydrogen Atom",
      explanation: "Same mission again",
    });
    expect(second).toBeNull();
    expect(useProgressStore.getState().discoveries.length).toBe(1);
  });

  it("recordBadgeAward dedupes by badgeId", async () => {
    await useProgressStore.getState().addProfile(profileA);
    useProgressStore.setState({ currentProfile: profileA });

    const a = await useProgressStore.getState().recordBadgeAward("first_steps");
    expect(a?.badgeId).toBe("first_steps");
    const b = await useProgressStore.getState().recordBadgeAward("first_steps");
    expect(b).toBeNull();
    expect(useProgressStore.getState().badges.length).toBe(1);
  });

  it("recordMasteryResult upserts by (worldId, phase)", async () => {
    await useProgressStore.getState().addProfile(profileA);
    useProgressStore.setState({ currentProfile: profileA });

    await useProgressStore.getState().recordMasteryResult({
      worldId: "foundations",
      phase: "pre",
      correctCount: 1,
      totalCount: 3,
    });
    expect(useProgressStore.getState().masteryResults.length).toBe(1);

    // Re-take the same phase — replaces the prior record, not duplicates.
    await useProgressStore.getState().recordMasteryResult({
      worldId: "foundations",
      phase: "pre",
      correctCount: 3,
      totalCount: 3,
    });
    const results = useProgressStore.getState().masteryResults;
    expect(results.length).toBe(1);
    expect(results[0].correctCount).toBe(3);

    // Different phase coexists.
    await useProgressStore.getState().recordMasteryResult({
      worldId: "foundations",
      phase: "post",
      correctCount: 3,
      totalCount: 3,
    });
    expect(useProgressStore.getState().masteryResults.length).toBe(2);
  });

  it("removeProfile clears the saved id when removing the active profile", async () => {
    await useProgressStore.getState().addProfile(profileA);
    useProgressStore.getState().setCurrentProfile(profileA);
    expect(window.localStorage.getItem("sparklab_selected_profile")).toBe(
      "p1"
    );

    await useProgressStore.getState().removeProfile("p1");

    expect(window.localStorage.getItem("sparklab_selected_profile")).toBeNull();
  });

  it("markOnboardingComplete flips the flag on the active profile and persists", async () => {
    const fresh: PlayerProfile = {
      ...profileA,
      onboardingCompleted: false,
    };
    await useProgressStore.getState().addProfile(fresh);
    useProgressStore.setState({ currentProfile: fresh });

    await useProgressStore.getState().markOnboardingComplete();

    expect(useProgressStore.getState().currentProfile?.onboardingCompleted).toBe(
      true
    );
    // Persisted to the shim so a fresh load sees the new state too.
    expect(profilesStore.get("p1")?.onboardingCompleted).toBe(true);
  });

  it("markOnboardingComplete is a no-op when already completed", async () => {
    const completed: PlayerProfile = {
      ...profileA,
      onboardingCompleted: true,
    };
    await useProgressStore.getState().addProfile(completed);
    useProgressStore.setState({ currentProfile: completed });
    const before = profilesStore.get("p1");

    await useProgressStore.getState().markOnboardingComplete();

    // No write happened (we only put when transitioning false -> true).
    expect(profilesStore.get("p1")).toBe(before);
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
