import { describe, expect, it } from "vitest";
import { generateHint } from "@/engine/hints";
import type { HintSet, Mission, SceneAtom, SceneBond } from "@/types";

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
