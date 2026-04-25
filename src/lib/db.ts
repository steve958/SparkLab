import Dexie, { type Table } from "dexie";
import type {
  PlayerProfile,
  MissionProgress,
  PlayerSettings,
  SceneState,
  UndoCommand,
} from "@/types";

export interface SaveSlot {
  id?: number;
  profileId: string;
  missionId: string;
  sceneState: SceneState;
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  timestamp: number;
}

class SparkLabDatabase extends Dexie {
  profiles!: Table<PlayerProfile>;
  progress!: Table<MissionProgress>;
  saves!: Table<SaveSlot>;
  settings!: Table<PlayerSettings>;

  constructor() {
    super("SparkLabDB");
    this.version(1).stores({
      profiles: "id, name, createdAt",
      progress: "[profileId+missionId], profileId, missionId, stars, completedAt",
      saves: "[profileId+missionId], profileId, missionId, timestamp",
      settings: "profileId",
    });
  }
}

export const db = new SparkLabDatabase();

export async function getProfiles(): Promise<PlayerProfile[]> {
  return db.profiles.toArray();
}

export async function createProfile(
  profile: PlayerProfile
): Promise<PlayerProfile> {
  await db.profiles.add(profile);
  return profile;
}

export async function deleteProfile(profileId: string): Promise<void> {
  await db.profiles.delete(profileId);
  await db.progress.where({ profileId }).delete();
  await db.saves.where({ profileId }).delete();
  await db.settings.where({ profileId }).delete();
}

export async function getProgressForProfile(
  profileId: string
): Promise<MissionProgress[]> {
  return db.progress.where({ profileId }).toArray();
}

export async function getMissionProgress(
  profileId: string,
  missionId: string
): Promise<MissionProgress | undefined> {
  return db.progress.get([profileId, missionId]);
}

export async function saveMissionProgress(
  progress: MissionProgress
): Promise<void> {
  await db.progress.put(progress);
}

export async function getSaveSlot(
  profileId: string,
  missionId: string
): Promise<SaveSlot | undefined> {
  return db.saves.get([profileId, missionId]);
}

export async function saveSlot(slot: SaveSlot): Promise<void> {
  await db.saves.put(slot);
}

export async function getSettings(
  profileId: string
): Promise<PlayerSettings | undefined> {
  return db.settings.get(profileId);
}

export async function saveSettings(settings: PlayerSettings): Promise<void> {
  await db.settings.put(settings);
}

export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const [profiles, progress, saves, settings] = await Promise.all([
    db.profiles.toArray(),
    db.progress.toArray(),
    db.saves.toArray(),
    db.settings.toArray(),
  ]);

  return {
    profiles,
    progress,
    saves,
    settings,
  };
}

export async function deleteAllData(): Promise<void> {
  await db.profiles.clear();
  await db.progress.clear();
  await db.saves.clear();
  await db.settings.clear();
}
