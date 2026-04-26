import type {
  SceneAtom,
  SceneBond,
  HintSet,
  Mission,
  Molecule,
  Element,
  AttemptOutcome,
  AttemptRecord,
  HintAction,
} from "@/types";
import { getBondsForAtom, countBondOrder } from "./bond";

export interface HintResult {
  tier: number;
  text: string;
  action: HintAction | string;
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

// ============================================================================
// Adaptive hint v1.5
// ============================================================================
// Goals (from roadmap.v2 Phase 1):
//   - track per-mission attempts and error patterns
//   - adjust hint *content* on repeat failure
//   - introduce "show-me" action that animates the canvas
//
// Implementation choice: hints are derived entirely from the current scene
// against the mission target. This keeps the system content-free until
// hint_sets.json authoring lands in Phase 2; missions can ship without
// per-mission hint copy and still get specific, helpful guidance.

export interface AnalysisContext {
  mission: Mission;
  atoms: SceneAtom[];
  bonds: SceneBond[];
  molecules: Molecule[];
  elements: Element[];
}

export interface AttemptAnalysis {
  outcome: AttemptOutcome;
  detail?: string;
  // Atoms relevant to the diagnosis (e.g. unbonded atoms, atoms with
  // incomplete valence). UI can use this to highlight on the canvas.
  highlightAtomIds: string[];
}

/**
 * Inspect a scene against a mission's success conditions to derive a single
 * dominant attempt outcome plus the atoms most relevant to the failure.
 * Always returns a result; "other" is the catch-all when nothing specific
 * matches.
 */
export function analyzeAttempt(ctx: AnalysisContext): AttemptAnalysis {
  const { mission, atoms, bonds, molecules } = ctx;

  if (atoms.length === 0) {
    return { outcome: "no-atoms", highlightAtomIds: [] };
  }

  switch (mission.objectiveType) {
    case "build-atom": {
      const cond = mission.successConditions[0];
      if (cond?.type !== "build-atom")
        return { outcome: "other", highlightAtomIds: [] };
      const target = cond.targetElement;
      const targetCount = atoms.filter((a) => a.elementId === target).length;
      if (targetCount === 0) {
        return {
          outcome: "wrong-element-built",
          detail: target,
          highlightAtomIds: atoms.map((a) => a.id),
        };
      }
      // Has at least one of the target element — close to success or
      // structurally fine. Treat as "other" so generic hints apply.
      return { outcome: "other", highlightAtomIds: [] };
    }

    case "count-atoms": {
      const counts = new Map<string, number>();
      for (const a of atoms)
        counts.set(a.elementId, (counts.get(a.elementId) ?? 0) + 1);
      for (const cond of mission.successConditions) {
        if (cond.type !== "count-atoms") continue;
        const have = counts.get(cond.element) ?? 0;
        if (have !== cond.count) {
          return {
            outcome: "wrong-atom-counts",
            detail: `${cond.element}:${have}/${cond.count}`,
            highlightAtomIds: atoms
              .filter((a) => a.elementId === cond.element)
              .map((a) => a.id),
          };
        }
      }
      return { outcome: "other", highlightAtomIds: [] };
    }

    case "build-molecule": {
      const targetId = mission.allowedMolecules[0];
      const target = molecules.find((m) => m.moleculeId === targetId);
      if (!target) return { outcome: "other", highlightAtomIds: [] };

      // Compare atom counts vs target.
      const sceneCounts = new Map<string, number>();
      for (const a of atoms)
        sceneCounts.set(a.elementId, (sceneCounts.get(a.elementId) ?? 0) + 1);
      const targetCounts = new Map<string, number>();
      for (const node of target.allowedBondGraph.nodes) {
        targetCounts.set(
          node.elementId,
          (targetCounts.get(node.elementId) ?? 0) + 1
        );
      }

      // Missing element entirely?
      for (const [el, want] of targetCounts) {
        const have = sceneCounts.get(el) ?? 0;
        if (have === 0) {
          return {
            outcome: "missing-element",
            detail: `${el}:${want}`,
            highlightAtomIds: [],
          };
        }
        if (have !== want) {
          return {
            outcome: "wrong-atom-counts",
            detail: `${el}:${have}/${want}`,
            highlightAtomIds: atoms
              .filter((a) => a.elementId === el)
              .map((a) => a.id),
          };
        }
      }
      // Extra elements not in target?
      for (const [el, have] of sceneCounts) {
        if (!targetCounts.has(el)) {
          return {
            outcome: "extra-element",
            detail: `${el}:${have}`,
            highlightAtomIds: atoms
              .filter((a) => a.elementId === el)
              .map((a) => a.id),
          };
        }
      }

      // Counts match — diagnose connectivity.
      const unbonded = findUnbondedAtoms(atoms, bonds);
      if (unbonded.length > 0) {
        return { outcome: "unbonded-atoms", highlightAtomIds: unbonded };
      }

      const incomplete = findIncompleteValence(atoms, bonds);
      if (incomplete.length > 0) {
        return { outcome: "incomplete-valence", highlightAtomIds: incomplete };
      }

      // Everything connected with full valence but the molecule didn't match
      // the target's bond pattern — wrong overall structure.
      return {
        outcome: "wrong-structure",
        highlightAtomIds: atoms.map((a) => a.id),
      };
    }

    case "run-reaction": {
      // Reaction balance is validated elsewhere (reaction.ts). Here we just
      // surface a connectivity / structure-level diagnosis on the scene.
      const unbonded = findUnbondedAtoms(atoms, bonds);
      if (unbonded.length > 0) {
        return { outcome: "unbonded-atoms", highlightAtomIds: unbonded };
      }
      return { outcome: "unbalanced-reaction", highlightAtomIds: [] };
    }
  }

  return { outcome: "other", highlightAtomIds: [] };
}

/**
 * Adaptive hint generator. Looks at the current scene plus recent attempt
 * history to produce specific, actionable text. Repeat-failure patterns
 * escalate the hint specificity even when `hintsUsed` is low.
 *
 * Escalation ladder (per repeat of the same outcome):
 *   1st time: gentle nudge, generic
 *   2nd time: specific to the error (counts, element, valence target)
 *   3rd+:    "show-me" action — UI should highlight target atoms/bonds
 */
export function generateAdaptiveHint(
  ctx: AnalysisContext,
  hintsUsed: number,
  attempts: AttemptRecord[]
): HintResult {
  const analysis = analyzeAttempt(ctx);

  // How many recent attempts share the current outcome? Walk backwards
  // until we hit a "success" (which only appears post-completion) or a
  // different outcome.
  let repeats = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].outcome !== analysis.outcome) break;
    repeats++;
  }

  // Tier from explicit hint clicks; repeats add pressure on top.
  // Mapping: 1st fail = generic, 2nd = specific, 3rd+ = show-me.
  // (pressure=0 -> tier 0, =1 -> tier 1, =2+ -> tier 2 + show-me action.)
  const pressure = hintsUsed + Math.max(0, repeats - 1);
  const tier = Math.min(2, pressure);
  const wantsShowMe = pressure >= 2;

  const action: HintAction = wantsShowMe
    ? "show-me"
    : tier === 0
      ? "explain-concept"
      : "highlight-atoms";

  return {
    tier,
    text: hintTextFor(ctx, analysis, tier, wantsShowMe),
    action,
    actionPayload: analysis.highlightAtomIds.length
      ? analysis.highlightAtomIds
      : undefined,
  };
}

function hintTextFor(
  ctx: AnalysisContext,
  analysis: AttemptAnalysis,
  tier: number,
  wantsShowMe: boolean
): string {
  const target = ctx.molecules.find(
    (m) => m.moleculeId === ctx.mission.allowedMolecules[0]
  );
  const targetName = target?.displayName ?? "this molecule";

  switch (analysis.outcome) {
    case "no-atoms":
      return "Start by adding an atom from the tray below.";
    case "wrong-element-built":
      return `This mission needs a ${analysis.detail ?? "different"} atom — try removing what's there and adding the right one.`;
    case "missing-element": {
      const [el, want] = (analysis.detail ?? "").split(":");
      return `${targetName} needs ${want} ${el} atom${want === "1" ? "" : "s"} — add one to your bench.`;
    }
    case "wrong-atom-counts": {
      const [el, fraction] = (analysis.detail ?? "").split(":");
      const [have, want] = (fraction ?? "0/0").split("/");
      if (Number(have) > Number(want)) {
        return `You have ${have} ${el} atoms, but ${targetName} only needs ${want}. Try removing ${Number(have) - Number(want)}.`;
      }
      return `You have ${have} ${el} atom${have === "1" ? "" : "s"}, but ${targetName} needs ${want}. Add ${Number(want) - Number(have)} more.`;
    }
    case "extra-element": {
      const [el] = (analysis.detail ?? "").split(":");
      return `${el} isn't part of ${targetName}. Try removing it and using only the elements in the tray.`;
    }
    case "unbonded-atoms":
      if (wantsShowMe) {
        return "Watch — these atoms need to connect. Click them in the order shown to bond them.";
      }
      if (tier >= 1) {
        return "Some atoms aren't connected yet. Click two atoms in a row to bond them together.";
      }
      return "Look for atoms that aren't linked to anything else.";
    case "incomplete-valence":
      if (wantsShowMe) {
        return "Watch — the highlighted atoms still need more bonds. Each element wants a specific number of connections.";
      }
      if (tier >= 1) {
        return "Some atoms still need more bonds. Carbon wants 4 bonds, oxygen wants 2, hydrogen wants 1.";
      }
      return "Check that each atom has the right number of bonds for its element.";
    case "wrong-structure":
      if (wantsShowMe) {
        return `Watch the target shape — try to match the way ${targetName}'s atoms connect.`;
      }
      return `The atoms are connected, but the shape doesn't match ${targetName} yet. Try a different bond pattern.`;
    case "unbalanced-reaction":
      return "The reactants and products don't balance yet — every atom on the left needs to appear on the right.";
    case "other":
    case "success":
    default:
      return "Take another look at your scene. What does the mission ask for?";
  }
}
