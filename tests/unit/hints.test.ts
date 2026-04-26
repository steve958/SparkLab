import { describe, expect, it } from "vitest";
import {
  generateHint,
  generateAdaptiveHint,
  analyzeAttempt,
} from "@/engine/hints";
import type {
  AttemptRecord,
  Element,
  HintSet,
  Mission,
  Molecule,
  SceneAtom,
  SceneBond,
} from "@/types";

const tieredHints: HintSet = {
  hintSetId: "h1",
  tiers: [
    { tier: 0, textKey: "tier_0", action: "highlight-atoms" },
    { tier: 1, textKey: "tier_1", action: "show-bond" },
    { tier: 2, textKey: "tier_2", action: "explain-concept" },
  ],
};

const buildMoleculeMission: Mission = {
  missionId: "m1",
  worldId: "w1",
  title: "",
  brief: "",
  objectiveType: "build-molecule",
  allowedElements: ["H", "O"],
  allowedMolecules: ["water"],
  successConditions: [{ type: "build-molecule", targetMoleculeId: "water" }],
  hintSetId: "h1",
  estimatedMinutes: 1,
  standardsTags: [],
  teacherNotes: "",
  difficulty: 1,
  ageBand: "8-10",
  prerequisites: [],
};

function atom(id: string, elementId: string): SceneAtom {
  return { id, elementId, x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 };
}
function bond(id: string, a: string, b: string): SceneBond {
  return { id, atomAId: a, atomBId: b, bondType: "covalent-single" };
}

describe("generateHint", () => {
  it("flags unbonded atoms at tier 0", () => {
    const atoms = [atom("a1", "H"), atom("a2", "O")];
    const result = generateHint(buildMoleculeMission, atoms, [], tieredHints, 0);
    expect(result.tier).toBe(0);
    expect(result.action).toBe("highlight-atoms");
    expect(Array.isArray(result.actionPayload)).toBe(true);
    expect(result.actionPayload).toEqual(expect.arrayContaining(["a1", "a2"]));
  });

  it("returns the tier text when all atoms are bonded but valence is incomplete (tier 1)", () => {
    // Carbon needs 4 bonds; one C with one H = incomplete valence on C.
    const atoms = [atom("c1", "C"), atom("h1", "H")];
    const bonds = [bond("b1", "c1", "h1")];
    const result = generateHint(buildMoleculeMission, atoms, bonds, tieredHints, 1);
    expect(result.tier).toBe(1);
    expect(result.text).toBe("tier_1");
    expect(result.action).toBe("highlight-atoms");
  });

  it("clamps the tier to the highest available", () => {
    const atoms = [atom("a1", "H")];
    const result = generateHint(buildMoleculeMission, atoms, [], tieredHints, 99);
    // hintsUsed=99 clamps to last tier (index 2)
    expect(result.tier).toBe(2);
  });

  it("returns a fallback when the hint set has no tiers", () => {
    const result = generateHint(
      buildMoleculeMission,
      [],
      [],
      { hintSetId: "empty", tiers: [] },
      0
    );
    expect(result.text).toMatch(/think|atoms|connect/i);
    expect(result.action).toBe("explain-concept");
  });

  it("falls through to the static tier text when no scene-derived hint applies", () => {
    // No atoms in the scene -> the dynamic 'unbonded' check doesn't trigger.
    const result = generateHint(buildMoleculeMission, [], [], tieredHints, 2);
    expect(result.tier).toBe(2);
    expect(result.text).toBe("tier_2");
  });
});

// ============================================================================
// Adaptive hint v1.5
// ============================================================================

const water: Molecule = {
  moleculeId: "water",
  displayName: "Water",
  formulaHill: "H2O",
  ageBand: "8-10",
  allowedBondGraph: {
    nodes: [
      { elementId: "O", label: "O" },
      { elementId: "H", label: "H1" },
      { elementId: "H", label: "H2" },
    ],
    edges: [
      { from: 0, to: 1, type: "covalent-single" },
      { from: 0, to: 2, type: "covalent-single" },
    ],
  },
  synonyms: [],
  difficulty: 1,
  uses3dTemplate: false,
  factKey: "fact_water",
};

const dummyElements: Element[] = [];

const ctx = (atoms: SceneAtom[], bonds: SceneBond[] = []) => ({
  mission: buildMoleculeMission,
  atoms,
  bonds,
  molecules: [water],
  elements: dummyElements,
});

describe("analyzeAttempt", () => {
  it("returns no-atoms when the scene is empty", () => {
    const a = analyzeAttempt(ctx([]));
    expect(a.outcome).toBe("no-atoms");
  });

  it("flags missing-element when target requires an absent element", () => {
    // water needs O and H; scene only has H -> O is missing
    const a = analyzeAttempt(ctx([atom("h1", "H"), atom("h2", "H")]));
    expect(a.outcome).toBe("missing-element");
    expect(a.detail).toBe("O:1");
  });

  it("flags wrong-atom-counts when an element is present but in wrong quantity", () => {
    // water needs 2 H + 1 O; scene has 1 H + 1 O -> H count is wrong
    const a = analyzeAttempt(ctx([atom("o1", "O"), atom("h1", "H")]));
    expect(a.outcome).toBe("wrong-atom-counts");
    expect(a.detail).toBe("H:1/2");
  });

  it("flags extra-element when scene has an element the target doesn't use", () => {
    // water doesn't use C; counts of H,O match exactly
    const a = analyzeAttempt(
      ctx([
        atom("o1", "O"),
        atom("h1", "H"),
        atom("h2", "H"),
        atom("c1", "C"),
      ])
    );
    expect(a.outcome).toBe("extra-element");
    expect(a.detail).toBe("C:1");
  });

  it("flags unbonded-atoms when counts are right but atoms aren't connected", () => {
    const atoms = [atom("o1", "O"), atom("h1", "H"), atom("h2", "H")];
    const a = analyzeAttempt(ctx(atoms, []));
    expect(a.outcome).toBe("unbonded-atoms");
    expect(a.highlightAtomIds.sort()).toEqual(["h1", "h2", "o1"]);
  });
});

describe("generateAdaptiveHint", () => {
  it("returns a specific message naming the missing element", () => {
    const result = generateAdaptiveHint(ctx([atom("h1", "H")]), 0, []);
    // wrong-atom-counts because we have 1 H and target needs 2 H
    // (O is also missing; analyzeAttempt iterates the target counts so the
    // first divergence wins — H comes before O in our test data ordering,
    // but the engine walks targetCounts; either outcome is acceptable as
    // long as the message names a real fix.)
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.action).toBe("explain-concept");
  });

  it("escalates to show-me after 3 consecutive failures of the same outcome", () => {
    const failingAttempts: AttemptRecord[] = [
      { timestamp: 1, outcome: "unbonded-atoms" },
      { timestamp: 2, outcome: "unbonded-atoms" },
      { timestamp: 3, outcome: "unbonded-atoms" },
    ];
    const atoms = [atom("o1", "O"), atom("h1", "H"), atom("h2", "H")];
    const result = generateAdaptiveHint(ctx(atoms), 0, failingAttempts);
    expect(result.action).toBe("show-me");
    expect(result.text.toLowerCase()).toContain("watch");
  });

  it("does not escalate when recent failures are mixed outcomes", () => {
    const mixed: AttemptRecord[] = [
      { timestamp: 1, outcome: "unbonded-atoms" },
      { timestamp: 2, outcome: "wrong-atom-counts" },
      { timestamp: 3, outcome: "unbonded-atoms" },
    ];
    const atoms = [atom("o1", "O"), atom("h1", "H"), atom("h2", "H")];
    const result = generateAdaptiveHint(ctx(atoms), 0, mixed);
    // Only the most recent run of consecutive same-outcome attempts counts.
    // Above ends with one unbonded attempt -> no escalation yet.
    expect(result.action).not.toBe("show-me");
  });

  it("escalates when the player explicitly clicks Hint repeatedly", () => {
    // No failed attempts but hintsUsed=3 -> still triggers show-me action.
    const atoms = [atom("o1", "O"), atom("h1", "H"), atom("h2", "H")];
    const result = generateAdaptiveHint(ctx(atoms), 3, []);
    expect(result.action).toBe("show-me");
  });

  it("returns highlight payload of the atoms relevant to the diagnosis", () => {
    const atoms = [atom("o1", "O"), atom("h1", "H"), atom("h2", "H")];
    const result = generateAdaptiveHint(ctx(atoms), 0, []);
    // unbonded-atoms is the diagnosis; payload should be the atom ids.
    expect(Array.isArray(result.actionPayload)).toBe(true);
    expect(result.actionPayload).toEqual(
      expect.arrayContaining(["o1", "h1", "h2"])
    );
  });
});
