import { create } from "zustand";
import type {
  PlayerProfile,
  MissionProgress,
  PlayerSettings,
  AdultSession,
  Discovery,
  BadgeAward,
  MasteryCheckResult,
} from "@/types";
import {
  getProfiles,
  createProfile,
  deleteProfile,
  updateProfile,
  getProgressForProfile,
  saveMissionProgress,
  getSettings,
  saveSettings,
  getDiscoveries,
  addDiscovery,
  hasDiscovery,
  getBadgeAwards,
  awardBadge,
  getMasteryResults,
  saveMasteryResult,
} from "@/lib/db";
import { audio } from "@/lib/audio";

const SELECTED_PROFILE_KEY = "sparklab_selected_profile";

const readSelectedProfileId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_PROFILE_KEY);
  } catch {
    return null;
  }
};

const writeSelectedProfileId = (id: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(SELECTED_PROFILE_KEY, id);
    else window.localStorage.removeItem(SELECTED_PROFILE_KEY);
  } catch {
    // Storage unavailable (private mode etc.) — soft-fail; in-memory state stays correct.
  }
};

export interface ProgressStore {
  profiles: PlayerProfile[];
  currentProfile: PlayerProfile | null;
  progress: MissionProgress[];
  settings: PlayerSettings | null;
  adultSession: AdultSession | null;
  discoveries: Discovery[];
  badges: BadgeAward[];
  masteryResults: MasteryCheckResult[];

  // Actions
  loadProfiles: () => Promise<void>;
  addProfile: (profile: PlayerProfile) => Promise<void>;
  removeProfile: (profileId: string) => Promise<void>;
  setCurrentProfile: (profile: PlayerProfile | null) => void;
  loadProgress: (profileId: string) => Promise<void>;
  updateProgress: (progress: MissionProgress) => Promise<void>;
  loadSettings: (profileId: string) => Promise<void>;
  updateSettings: (settings: PlayerSettings) => Promise<void>;
  setAdultSession: (session: AdultSession | null) => void;
  isMissionUnlocked: (missionId: string, prerequisites: string[]) => boolean;
  markOnboardingComplete: () => Promise<void>;
  loadDiscoveries: (profileId: string) => Promise<void>;
  addDiscoveryRecord: (
    discovery: Omit<Discovery, "id" | "createdAt">
  ) => Promise<Discovery | null>;
  loadBadges: (profileId: string) => Promise<void>;
  recordBadgeAward: (badgeId: string) => Promise<BadgeAward | null>;
  loadMasteryResults: (profileId: string) => Promise<void>;
  recordMasteryResult: (
    result: Omit<MasteryCheckResult, "profileId" | "takenAt">
  ) => Promise<MasteryCheckResult | null>;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  profiles: [],
  currentProfile: null,
  progress: [],
  settings: null,
  adultSession: null,
  discoveries: [],
  badges: [],
  masteryResults: [],

  loadProfiles: async () => {
    const profiles = await getProfiles();
    set({ profiles });

    // Rehydrate currentProfile from localStorage so refreshes / deep links
    // preserve the active session. We only restore if we don't already have
    // a current profile (avoid clobbering an in-flight switch).
    if (!get().currentProfile) {
      const savedId = readSelectedProfileId();
      if (savedId) {
        const match = profiles.find((p) => p.id === savedId);
        if (match) {
          get().setCurrentProfile(match);
        } else {
          writeSelectedProfileId(null);
        }
      }
    }
  },

  addProfile: async (profile) => {
    await createProfile(profile);
    await get().loadProfiles();
  },

  removeProfile: async (profileId) => {
    await deleteProfile(profileId);
    const current = get().currentProfile;
    if (current?.id === profileId) {
      set({ currentProfile: null, progress: [], settings: null });
      writeSelectedProfileId(null);
    }
    await get().loadProfiles();
  },

  setCurrentProfile: (profile) => {
    set({ currentProfile: profile });
    writeSelectedProfileId(profile?.id ?? null);
    if (profile) {
      get().loadProgress(profile.id);
      get().loadSettings(profile.id);
      get().loadDiscoveries(profile.id);
      get().loadBadges(profile.id);
      get().loadMasteryResults(profile.id);
    } else {
      set({ discoveries: [], badges: [], masteryResults: [] });
    }
  },

  loadProgress: async (profileId) => {
    const progress = await getProgressForProfile(profileId);
    set({ progress });
  },

  updateProgress: async (progress) => {
    await saveMissionProgress(progress);
    if (get().currentProfile) {
      await get().loadProgress(get().currentProfile!.id);
    }
  },

  loadSettings: async (profileId) => {
    const settings = await getSettings(profileId);
    if (settings) {
      set({ settings });
      audio.setEnabled(settings.soundEnabled);
      audio.setReducedMotion(settings.reducedMotion);
    } else {
      const defaultSettings: PlayerSettings = {
        profileId,
        reducedMotion: false,
        soundEnabled: true,
        highContrast: false,
        language: "en",
      };
      await saveSettings(defaultSettings);
      set({ settings: defaultSettings });
      audio.setEnabled(true);
      audio.setReducedMotion(false);
    }
  },

  updateSettings: async (settings) => {
    await saveSettings(settings);
    set({ settings });
  },

  setAdultSession: (session) => set({ adultSession: session }),

  isMissionUnlocked: (missionId, prerequisites) => {
    const { progress } = get();
    if (prerequisites.length === 0) return true;
    return prerequisites.every((preId) => {
      const pre = progress.find((p) => p.missionId === preId);
      return pre && pre.stars >= 1;
    });
  },

  markOnboardingComplete: async () => {
    const current = get().currentProfile;
    if (!current || current.onboardingCompleted) return;
    const updated: PlayerProfile = {
      ...current,
      onboardingCompleted: true,
    };
    await updateProfile(updated);
    set({
      currentProfile: updated,
      profiles: get().profiles.map((p) => (p.id === updated.id ? updated : p)),
    });
  },

  loadDiscoveries: async (profileId) => {
    const discoveries = await getDiscoveries(profileId);
    set({ discoveries });
  },

  addDiscoveryRecord: async (input) => {
    const current = get().currentProfile;
    if (!current || current.id !== input.profileId) return null;
    // Dedupe: don't double-record the same (kind + refId) for one profile.
    const dup = await hasDiscovery(input.profileId, input.kind, input.refId);
    if (dup) return null;
    const discovery: Discovery = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await addDiscovery(discovery);
    set((state) => ({ discoveries: [discovery, ...state.discoveries] }));
    return discovery;
  },

  loadBadges: async (profileId) => {
    const badges = await getBadgeAwards(profileId);
    set({ badges });
  },

  recordBadgeAward: async (badgeId) => {
    const current = get().currentProfile;
    if (!current) return null;
    if (get().badges.some((b) => b.badgeId === badgeId)) return null;
    const award: BadgeAward = {
      profileId: current.id,
      badgeId,
      earnedAt: Date.now(),
    };
    await awardBadge(award);
    set((state) => ({ badges: [...state.badges, award] }));
    return award;
  },

  loadMasteryResults: async (profileId) => {
    const masteryResults = await getMasteryResults(profileId);
    set({ masteryResults });
  },

  recordMasteryResult: async (input) => {
    const current = get().currentProfile;
    if (!current) return null;
    const result: MasteryCheckResult = {
      ...input,
      profileId: current.id,
      takenAt: Date.now(),
    };
    await saveMasteryResult(result);
    // Replace any existing record for the same (worldId, phase) key.
    set((state) => ({
      masteryResults: [
        ...state.masteryResults.filter(
          (r) =>
            !(r.worldId === input.worldId && r.phase === input.phase)
        ),
        result,
      ],
    }));
    return result;
  },
}));
