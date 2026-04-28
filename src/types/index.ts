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
  // When true, this rule is only considered during a deliberate
  // bond-upgrade action (the player tapping two atoms that are
  // already bonded). Fresh-bond formation skips it. Used for
  // chemistry-exotic higher-order bonds like C≡O — the engine's
  // default for a fresh C-O pair should be C=O (carbonyls,
  // CO₂-style), with C≡O reachable as an explicit upgrade.
  upgradeOnly?: boolean;
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
  explanationQuiz?: ExplanationQuiz;
}

export interface ExplanationQuiz {
  question: string;
  options: string[];
  correctIndex: number;
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
  // Reaction-mission side intent. Set by the side-aware spawn buttons
  // (Reactants / Products) in reaction-mode missions and used by both
  // the AtomLedger and the conservation validator instead of a fragile
  // centerX-vs-atom-x partition. Persists across drags so the chemistry
  // role stays what the player asked for, not what a coordinate guess
  // happens to say after zooming or panning. Undefined in non-reaction
  // missions and on legacy persisted scenes; consumers fall back to the
  // position-based partition when missing.
  side?: "reactants" | "products";
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
  // Per-mission attempt history; cleared on initMission. Drives adaptive
  // hint content — e.g. repeated "unbonded-atoms" failures escalate the
  // hint from a generic nudge to a "show-me" demonstration.
  attempts: AttemptRecord[];
}

export interface AttemptRecord {
  timestamp: number;
  outcome: AttemptOutcome;
  // Free-form detail the engine can inspect (e.g. specific element symbol,
  // atom id, or count). Kept loose so analyzers can attach what they need.
  detail?: string;
}

export type AttemptOutcome =
  | "success"
  | "no-atoms"
  | "wrong-atom-counts"
  | "missing-element"
  | "extra-element"
  | "unbonded-atoms"
  | "incomplete-valence"
  | "wrong-structure"
  | "unbalanced-reaction"
  | "wrong-element-built"
  | "other";

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
  // Marked true after the player completes the first-run tutorial. Older
  // profiles stored before this field existed default to undefined and are
  // treated as "completed" so we don't re-onboard returning users.
  onboardingCompleted?: boolean;
  // Phase 2 avatar customization. Optional so legacy profiles still
  // render via the AvatarBadge defaults.
  avatarColor?: string;     // hex from the curated palette
  avatarAccessory?: string; // lucide icon name; renderer falls back if unknown
}

export interface MissionProgress {
  profileId: string;
  missionId: string;
  stars: number;
  completedAt: number | null;
  attempts: number;
  bestIndependenceScore: number;
}

// A "discovery" is a single artifact written when a player makes
// something noteworthy — completing a mission, building a recognized
// molecule in sandbox, etc. The notebook ([/notebook](src/app/notebook))
// reads these and renders sticker-style entries.
export interface Discovery {
  id: string;            // crypto.randomUUID()
  profileId: string;
  kind: DiscoveryKind;
  // Reference to the underlying content. For mission discoveries this is
  // the missionId; for sandbox creations it's the matched moleculeId
  // (or "free-form" if the structure doesn't match a known molecule).
  refId: string;
  // Free-form display label captured at discovery time so renames in
  // content don't make old entries unreadable.
  label: string;
  // One-line explanation captured at discovery time, ditto.
  explanation: string;
  createdAt: number;
}

export type DiscoveryKind =
  | "mission-complete"
  | "sandbox-molecule"
  | "first-element-built";

// Earned achievements. Definitions live in
// [public/data/badges.json](public/data/badges.json); player records of
// which they've earned live in IndexedDB.
export interface BadgeAward {
  profileId: string;
  badgeId: string;       // matches a definition in badges.json
  earnedAt: number;
}

export interface BadgeDefinition {
  badgeId: string;
  // Title shown on the badge card / toast.
  title: string;
  // One-line description of what the player did.
  description: string;
  // Lucide icon name (e.g. "Sparkles", "FlaskConical"). The renderer
  // looks up the icon dynamically; ship a fallback if the name is wrong.
  icon: string;
  // Hex color used for the badge background. Falls back to primary green.
  color?: string;
  // Trigger condition. The badge engine evaluates these against the
  // player's progress + discovery history when relevant events fire.
  trigger: BadgeTrigger;
}

export type BadgeTrigger =
  | { kind: "first-mission-complete" }
  | { kind: "first-molecule"; moleculeId: string }
  | { kind: "complete-world"; worldId: string }
  | { kind: "no-hint-clear"; missionId?: string }
  | { kind: "perfect-mission"; missionId?: string }
  | { kind: "mission-count"; count: number }
  | { kind: "elements-discovered"; count: number };

// Mastery checks — per-world pre/post quizlets that bracket each world.
// Pre-check measures starting knowledge, post-check measures lift; the
// gap between them is the mastery improvement signal Phase 2 ships
// against (+10pp target in roadmap.v2).
export interface MasteryQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface WorldMasteryCheck {
  worldId: string;
  pre: MasteryQuestion[];
  post: MasteryQuestion[];
}

export interface MasteryCheckResult {
  profileId: string;
  worldId: string;
  phase: "pre" | "post";
  correctCount: number;
  totalCount: number;
  takenAt: number;
}

// Telemetry — privacy-reviewed event schema. No free-text fields.
// Stored in IndexedDB only; rolling 90-day retention. Powers the
// parent-dashboard analytics view. See compliance/posture.md.
export type TelemetryEventKind =
  | "mission_start"
  | "mission_complete"
  | "hint_used"
  | "mastery_check"
  | "sandbox_save";

export interface TelemetryEventBase {
  // Auto-generated id so we can index and delete in batches.
  id: string;
  // Profile that emitted the event. Stays inside this device.
  profileId: string;
  kind: TelemetryEventKind;
  ts: number;
}

// Distributive Omit so callers can pass a single variant minus the
// auto-filled `id` and `ts` without TS collapsing the union down to
// common keys (which would lose worldId / missionId / etc.).
export type TelemetryEventInput = TelemetryEvent extends infer E
  ? E extends TelemetryEventBase
    ? Omit<E, "id" | "ts">
    : never
  : never;

export type TelemetryEvent =
  | (TelemetryEventBase & {
      kind: "mission_start";
      missionId: string;
      worldId: string;
      ageBand: AgeBand;
    })
  | (TelemetryEventBase & {
      kind: "mission_complete";
      missionId: string;
      worldId: string;
      ageBand: AgeBand;
      stars: number;
      hintsUsed: number;
      attempts: number;
      durationMs: number;
    })
  | (TelemetryEventBase & {
      kind: "hint_used";
      missionId: string;
      tier: number;
      outcome: AttemptOutcome | "no-attempt-yet";
    })
  | (TelemetryEventBase & {
      kind: "mastery_check";
      worldId: string;
      phase: "pre" | "post";
      correctCount: number;
      totalCount: number;
    })
  | (TelemetryEventBase & {
      kind: "sandbox_save";
      // null when the structure didn't match a known molecule.
      moleculeId: string | null;
      atomCount: number;
    });

// Parent account — gated entry to the dashboard, password-protected
// data-export/delete, and the future cloud-sync opt-in. Local-only;
// see [compliance/posture.md](../../compliance/posture.md).
export interface ParentAccount {
  // Email lower-cased and trimmed; used as the Dexie key.
  email: string;
  // base64-encoded PBKDF2 derived key.
  passwordHash: string;
  // base64-encoded random salt unique to this account.
  salt: string;
  // PBKDF2 iteration count captured at creation so we can rehash on
  // upgrade without invalidating existing accounts.
  iterations: number;
  createdAt: number;
  lastLoginAt: number | null;
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
  action: HintAction;
  actionPayload?: unknown;
}

export type HintAction =
  | "highlight-atoms"
  | "show-bond"
  | "show-target"
  | "explain-concept"
  | "show-me";

// ============================================================================
// Dashboard / Adult
// ============================================================================

export interface AdultSession {
  type: "parent" | "teacher";
  // Email of the authenticated parent. Older `pin` field retained as an
  // optional for back-compat with legacy Phase 1 sessions and dropped on
  // next login.
  email?: string;
  pin?: string;
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
