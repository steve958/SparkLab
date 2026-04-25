import type { SceneAtom, SceneBond, HintSet, Mission } from "@/types";
import { getBondsForAtom, countBondOrder } from "./bond";

export interface HintResult {
  tier: number;
  text: string;
  action: string;
  actionPayload?: unknown;
}

export function generateHint(
  mission: Mission,
  sceneAtoms: SceneAtom[],
  sceneBonds: SceneBond[],
  hintSet: HintSet,
  hintsUsed: number
): HintResult {
  const tier = Math.min(hintsUsed, hintSet.tiers.length - 1);
  const tierData = hintSet.tiers[tier];

  if (!tierData) {
    return {
      tier: 0,
      text: "Think about what atoms you need and how they connect.",
      action: "explain-concept",
    };
  }

  // Dynamic hints based on mission type and scene state
  if (mission.objectiveType === "build-molecule" && sceneAtoms.length > 0) {
    const targetMoleculeId = mission.allowedMolecules[0];
    if (targetMoleculeId) {
      const unbonded = findUnbondedAtoms(sceneAtoms, sceneBonds);
      if (unbonded.length > 0 && tier === 0) {
        return {
          tier: 0,
          text: `Some atoms are not connected yet. Try bonding them together.`,
          action: "highlight-atoms",
          actionPayload: unbonded,
        };
      }

      const incomplete = findIncompleteValence(sceneAtoms, sceneBonds);
      if (incomplete.length > 0 && tier === 1) {
        return {
          tier: 1,
          text: tierData.textKey,
          action: "highlight-atoms",
          actionPayload: incomplete,
        };
      }
    }
  }

  return {
    tier,
    text: tierData.textKey,
    action: tierData.action,
    actionPayload: tierData.actionPayload,
  };
}

function findUnbondedAtoms(
  atoms: SceneAtom[],
  bonds: SceneBond[]
): string[] {
  const bonded = new Set<string>();
  for (const b of bonds) {
    bonded.add(b.atomAId);
    bonded.add(b.atomBId);
  }
  return atoms.filter((a) => !bonded.has(a.id)).map((a) => a.id);
}

function findIncompleteValence(
  atoms: SceneAtom[],
  bonds: SceneBond[]
): string[] {
  // Simplified: find atoms with fewer bonds than typical
  const result: string[] = [];
  for (const atom of atoms) {
    const atomBonds = getBondsForAtom(atom.id, bonds);
    const bondOrder = countBondOrder(atomBonds);

    // Simple heuristic based on element
    let expected = 0;
    switch (atom.elementId) {
      case "H":
        expected = 1;
        break;
      case "O":
        expected = 2;
        break;
      case "C":
        expected = 4;
        break;
      case "N":
        expected = 3;
        break;
      case "Cl":
        expected = 1;
        break;
      case "Na":
        expected = 1;
        break;
      default:
        expected = 0;
    }

    if (expected > 0 && bondOrder < expected) {
      result.push(atom.id);
    }
  }
  return result;
}
