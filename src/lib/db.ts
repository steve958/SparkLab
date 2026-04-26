import Dexie, { type Table } from "dexie";
import type {
  PlayerProfile,
  MissionProgress,
  PlayerSettings,
  SceneState,
  UndoCommand,
  Discovery,
  BadgeAward,
  MasteryCheckResult,
  ParentAccount,
  TelemetryEvent,
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
  discoveries!: Table<Discovery>;
  badges!: Table<BadgeAward>;
  masteryResults!: Table<MasteryCheckResult>;
  parents!: Table<ParentAccount>;
  telemetry!: Table<TelemetryEvent>;

  constructor() {
    super("SparkLabDB");
    this.version(1).stores({
      profiles: "id, name, createdAt",
      progress: "[profileId+missionId], profileId, missionId, stars, completedAt",
      saves: "[profileId+missionId], profileId, missionId, timestamp",
      settings: "profileId",
    });
    // v2 (Phase 2): discoveries (notebook entries) + badges (awards).
    // Dexie applies upgrades cumulatively; existing v1 stores are kept.
    this.version(2).stores({
      discoveries: "id, profileId, kind, createdAt",
      badges: "[profileId+badgeId], profileId, badgeId, earnedAt",
    });
    // v3 (Phase 2): per-world pre/post mastery check results.
    this.version(3).stores({
      masteryResults:
        "[profileId+worldId+phase], profileId, worldId, phase, takenAt",
    });
    // v4 (Phase 3): parent accounts for the new dashboard auth.
    this.version(4).stores({
      parents: "email, createdAt, lastLoginAt",
    });
    // v5 (Phase 3): telemetry events with rolling 90-day retention.
    this.version(5).stores({
      telemetry: "id, profileId, kind, ts",
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

export async function updateProfile(
  profile: PlayerProfile
): Promise<PlayerProfile> {
  await db.profiles.put(profile);
  return profile;
}

export async function deleteProfile(profileId: string): Promise<void> {
  await db.profiles.delete(profileId);
  await db.progress.where({ profileId }).delete();
  await db.saves.where({ profileId }).delete();
  await db.settings.where({ profileId }).delete();
  await db.discoveries.where({ profileId }).delete();
  await db.badges.where({ profileId }).delete();
  await db.masteryResults.where({ profileId }).delete();
  await db.telemetry.where({ profileId }).delete();
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
  const [
    profiles,
    progress,
    saves,
    settings,
    discoveries,
    badges,
    masteryResults,
  ] = await Promise.all([
    db.profiles.toArray(),
    db.progress.toArray(),
    db.saves.toArray(),
    db.settings.toArray(),
    db.discoveries.toArray(),
    db.badges.toArray(),
    db.masteryResults.toArray(),
  ]);

  return {
    profiles,
    progress,
    saves,
    settings,
    discoveries,
    badges,
    masteryResults,
  };
}

export async function deleteAllData(): Promise<void> {
  await db.profiles.clear();
  await db.progress.clear();
  await db.saves.clear();
  await db.settings.clear();
  await db.discoveries.clear();
  await db.badges.clear();
  await db.masteryResults.clear();
  await db.parents.clear();
  await db.telemetry.clear();
}

// ============================================================================
// Discoveries (notebook)
// ============================================================================

export async function getDiscoveries(profileId: string): Promise<Discovery[]> {
  return db.discoveries
    .where({ profileId })
    .reverse()
    .sortBy("createdAt");
}

export async function addDiscovery(discovery: Discovery): Promise<void> {
  await db.discoveries.put(discovery);
}

export async function hasDiscovery(
  profileId: string,
  kind: Discovery["kind"],
  refId: string
): Promise<boolean> {
  const match = await db.discoveries
    .where({ profileId })
    .filter((d) => d.kind === kind && d.refId === refId)
    .first();
  return !!match;
}

// ============================================================================
// Badges
// ============================================================================

export async function getBadgeAwards(profileId: string): Promise<BadgeAward[]> {
  return db.badges.where({ profileId }).toArray();
}

export async function awardBadge(award: BadgeAward): Promise<void> {
  await db.badges.put(award);
}

// ============================================================================
// Mastery check results
// ============================================================================

export async function getMasteryResults(
  profileId: string
): Promise<MasteryCheckResult[]> {
  return db.masteryResults.where({ profileId }).toArray();
}

export async function saveMasteryResult(
  result: MasteryCheckResult
): Promise<void> {
  await db.masteryResults.put(result);
}
