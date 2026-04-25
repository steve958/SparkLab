// ============================================================================
// SparkLab - Core Type Definitions
// Based on PRD data model sheets: elements, bond_rules, molecules, reactions,
// missions, strings, assets
// ============================================================================

export type AgeBand = "6-7" | "8-10" | "11-14" | "15-16";

export type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide"
  | "unknown";

export type BondType = "ionic" | "covalent-single" | "covalent-double" | "covalent-triple";

export type MissionObjectiveType =
  | "build-atom"
  | "build-molecule"
  | "run-reaction"
  | "count-atoms"
  | "sort-classify"
  | "identify-change"
  | "periodic-pattern";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// Elements Sheet
// ============================================================================

export interface Element {
  atomicNumber: number;
  symbol: string;
  name: string;
  group: number;
  period: number;
  block: "s" | "p" | "d" | "f";
  category: ElementCategory;
  standardAtomicWeight: number;
  stateAtStp: "solid" | "liquid" | "gas";
  shellOccupancy: number[]; // e.g. [2, 1] for Li
  valenceElectronsMainGroup: number;
  commonOxidationStates: number[];
  electronegativityPauling: number | null;
  colorToken: string;
  iconAsset: string | null;
  unlockWorld: string;
  factCardKey: string;
  sourceRef: string;
}

// ============================================================================
// Bond Rules Sheet
// ============================================================================

export interface BondRule {
  ruleId: string;
  ageBand: AgeBand;
  atomA: string; // element symbol
  atomB: string; // element symbol
  bondType: BondType;
  maxOrder: number;
  slotCostA: number;
  slotCostB: number;
  formalChargeDeltaA: number;
  formalChargeDeltaB: number;
  geometryHint: string | null;
  allowedWorlds: string[];
  explanationKey: string;
}

// ============================================================================
// Molecules Sheet
// ============================================================================

export interface Molecule {
  moleculeId: string;
  displayName: string;
  formulaHill: string;
  ageBand: AgeBand;
  allowedBondGraph: BondGraph;
  synonyms: string[];
  difficulty: Difficulty;
  uses3dTemplate: boolean;
  factKey: string;
}

export interface BondGraph {
  nodes: { elementId: string; label?: string }[];
  edges: { from: number; to: number; type: BondType }[];
}

// ============================================================================
// Reactions Sheet
// ============================================================================

export interface Reaction {
  reactionId: string;
  ageBand: AgeBand;
  reactants: ReactantProduct[];
  products: ReactantProduct[];
  conditionTags: string[];
  conservationSignature: Record<string, number>; // element symbol -> count
  equationDisplay: string;
  animationTemplate: string | null;
  energyChangeLabel: string | null;
  standardsTags: string[];
}

export interface ReactantProduct {
  moleculeId: string;
  coefficient: number;
}

// ============================================================================
// Missions Sheet
// ============================================================================

export interface Mission {
  missionId: string;
  worldId: string;
  title: string;
  brief: string;
  objectiveType: MissionObjectiveType;
  allowedElements: string[]; // element symbols
  allowedMolecules: string[]; // moleculeIds
  successConditions: SuccessCondition[];
  hintSetId: string;
  estimatedMinutes: number;
  standardsTags: string[];
  teacherNotes: string;
  difficulty: Difficulty;
  ageBand: AgeBand;
  prerequisites: string[]; // missionIds
}

export type SuccessCondition =
  | { type: "build-atom"; targetElement: string; charge: number }
  | { type: "build-molecule"; targetMoleculeId: string }
  | { type: "run-reaction"; targetReactionId: string }
  | { type: "count-atoms"; element: string; count: number }
  | { type: "identify-property"; property: string; value: string };

// ============================================================================
// Strings Sheet
// ============================================================================

export interface LocalizedString {
  stringKey: string;
  locale: string;
  text: string;
  voiceoverRef: string | null;
  readingLevelBand: AgeBand;
}

// ============================================================================
// Assets Sheet
// ============================================================================

export interface Asset {
  assetId: string;
  type: "image" | "audio" | "video" | "sprite";
  filePath: string;
  license: string;
  localeVariant: string | null;
  altTextKey: string | null;
}

// ============================================================================
// Runtime Game State
// ============================================================================

export interface SceneAtom {
  id: string;
  elementId: string;
  x: number;
  y: number;
  protons: number;
  neutrons: number;
  electrons: number;
}

export interface SceneBond {
  id: string;
  atomAId: string;
  atomBId: string;
  bondType: BondType;
}

export interface SceneState {
  atoms: SceneAtom[];
  bonds: SceneBond[];
  inventory: Record<string, number>; // element symbol -> count available
}

export interface UndoCommand {
  type: "add-atom" | "remove-atom" | "move-atom" | "add-bond" | "remove-bond" | "update-inventory";
  payload: unknown;
  inverse: unknown;
}

export interface GameState {
  scene: SceneState;
  missionId: string | null;
  hintState: HintState;
  scoreState: ScoreState;
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
}

export interface HintState {
  hintsUsed: number;
  lastHintTier: number;
  cooldownEnd: number | null;
}

export interface ScoreState {
  stars: number;
  correctness: boolean;
  independenceScore: number; // 0-1 based on hint usage
  explanationCorrect: boolean | null;
  attempts: number;
  startTime: number;
  endTime: number | null;
}

// ============================================================================
// Player Progress
// ============================================================================

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  ageBand: AgeBand;
}

export interface MissionProgress {
  profileId: string;
  missionId: string;
  stars: number;
  completedAt: number | null;
  attempts: number;
  bestIndependenceScore: number;
}

export interface PlayerSettings {
  profileId: string;
  reducedMotion: boolean;
  soundEnabled: boolean;
  highContrast: boolean;
  language: string;
}

// ============================================================================
// Worlds
// ============================================================================

export interface World {
  worldId: string;
  name: string;
  description: string;
  ageBand: AgeBand;
  themeColor: string;
  unlockRequirements: string[];
  missionIds: string[];
}

// ============================================================================
// Hint System
// ============================================================================

export interface HintSet {
  hintSetId: string;
  tiers: HintTier[];
}

export interface HintTier {
  tier: number;
  textKey: string;
  action: "highlight-atoms" | "show-bond" | "show-target" | "explain-concept";
  actionPayload?: unknown;
}

// ============================================================================
// Dashboard / Adult
// ============================================================================

export interface AdultSession {
  type: "parent" | "teacher";
  pin: string;
  createdAt: number;
  expiresAt: number;
}

export interface ClassGroup {
  classId: string;
  name: string;
  teacherName: string;
  studentProfiles: string[]; // profileIds
  assignedMissions: string[];
  createdAt: number;
}

export interface ProgressReport {
  profileId: string;
  profileName: string;
  totalMissions: number;
  completedMissions: number;
  totalStars: number;
  timeSpentMinutes: number;
  missions: MissionProgress[];
}
