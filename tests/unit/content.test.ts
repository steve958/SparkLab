// Audits the actual JSON content shipped under public/data so that
// runtime lookups (e.g. `getString(strings, `explanation_${moleculeId}`)`)
// resolve to real text and not to the lookup key itself. getString
// silently falls back to the key when missing, which means the bug
// surfaces as `explanation_sodium_chloride` showing up in the player's
// notebook — easy to miss in code review, but caught here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface MoleculeNode {
  elementId: string;
}
interface MoleculeEdge {
  from: number;
  to: number;
  type: string;
}
interface MoleculeEntry {
  moleculeId: string;
  allowedBondGraph?: {
    nodes: MoleculeNode[];
    edges: MoleculeEdge[];
  };
}
interface ReactionEntry {
  reactionId: string;
}
interface StringEntry {
  stringKey: string;
  locale: string;
  text: string;
}
interface BondRuleEntry {
  ruleId: string;
  atomA: string;
  atomB: string;
  bondType: string;
}

function readJson<T>(relPath: string): T {
  const abs = resolve(__dirname, "../../public/data", relPath);
  return JSON.parse(readFileSync(abs, "utf-8")) as T;
}

const molecules = readJson<MoleculeEntry[]>("molecules.json");
const reactions = readJson<ReactionEntry[]>("reactions.json");
const strings = readJson<StringEntry[]>("strings.json");
const bondRules = readJson<BondRuleEntry[]>("bond_rules.json");

const englishKeys = new Set(
  strings.filter((s) => s.locale === "en").map((s) => s.stringKey)
);

describe("content explanations", () => {
  // The build-molecule check in app/src/app/game/page.tsx looks up
  // `explanation_${moleculeId}`. If it's missing, getString returns
  // the literal key as fallback and the player sees the raw key in
  // the success toast and in their notebook entry.
  it("every molecule has an explanation_<moleculeId> string in en", () => {
    const missing = molecules
      .map((m) => `explanation_${m.moleculeId}`)
      .filter((k) => !englishKeys.has(k));
    expect(missing).toEqual([]);
  });

  // Same contract for run-reaction missions, which look up
  // `explanation_${reactionId}` in the validate path.
  it("every reaction has an explanation_<reactionId> string in en", () => {
    const missing = reactions
      .map((r) => `explanation_${r.reactionId}`)
      .filter((k) => !englishKeys.has(k));
    expect(missing).toEqual([]);
  });

  // No empty strings — a present-but-empty entry would render as a
  // blank notebook explanation, which is just as broken as missing.
  it("explanation strings are non-empty", () => {
    const blanks = strings
      .filter(
        (s) =>
          s.stringKey.startsWith("explanation_") &&
          s.locale === "en" &&
          s.text.trim().length === 0
      )
      .map((s) => s.stringKey);
    expect(blanks).toEqual([]);
  });

  // Every bond an authored molecule actually contains MUST have a
  // matching bond rule, otherwise the tap-to-bond engine refuses
  // it and the player sees "X and Y do not form a bond in this
  // lesson" on a mission whose whole point is to build that bond.
  // This was the chlorine_gas regression: the molecule edge said
  // Cl-Cl covalent-single, but bond_rules.json had no cl-cl-single
  // entry — silently broken until the permissive fallback was
  // removed and the engine started enforcing the contract.
  it("every molecule edge has a matching bond rule", () => {
    const missingPairs: string[] = [];
    for (const mol of molecules) {
      if (!mol.allowedBondGraph) continue;
      for (const edge of mol.allowedBondGraph.edges) {
        const a = mol.allowedBondGraph.nodes[edge.from]?.elementId;
        const b = mol.allowedBondGraph.nodes[edge.to]?.elementId;
        if (!a || !b) continue;
        const found = bondRules.some(
          (r) =>
            r.bondType === edge.type &&
            ((r.atomA === a && r.atomB === b) ||
              (r.atomA === b && r.atomB === a))
        );
        if (!found) {
          missingPairs.push(
            `${mol.moleculeId}: ${a}-${b} ${edge.type}`
          );
        }
      }
    }
    expect(missingPairs).toEqual([]);
  });
});
