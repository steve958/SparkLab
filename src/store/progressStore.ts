import { create } from "zustand";
import type {
  PlayerProfile,
  MissionProgress,
  PlayerSettings,
  AdultSession,
} from "@/types";
import {
  getProfiles,
  createProfile,
  deleteProfile,
  getProgressForProfile,
  saveMissionProgress,
  getSettings,
  saveSettings,
} from "@/lib/db";
import { audio } from "@/lib/audio";

export interface ProgressStore {
  profiles: PlayerProfile[];
  currentProfile: PlayerProfile | null;
  progress: MissionProgress[];
  settings: PlayerSettings | null;
  adultSession: AdultSession | null;

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
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  profiles: [],
  currentProfile: null,
  progress: [],
  settings: null,
  adultSession: null,

  loadProfiles: async () => {
    const profiles = await getProfiles();
    set({ profiles });
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
    }
    await get().loadProfiles();
  },

  setCurrentProfile: (profile) => {
    set({ currentProfile: profile });
    if (profile) {
      get().loadProgress(profile.id);
      get().loadSettings(profile.id);
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
}));
