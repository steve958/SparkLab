import type { Element, BondRule, BondType, AgeBand } from "@/types";
import { getBondRulesForPair } from "@/data/loader";

export interface BondValidationResult {
  valid: boolean;
  bondType: BondType | null;
  formalChargeA: number;
  formalChargeB: number;
  explanation: string;
  geometryHint: string | null;
}

export function validateBond(
  rules: BondRule[],
  elementA: Element,
  elementB: Element,
  ageBand: AgeBand,
  existingBondsA: number,
  existingBondsB: number
): BondValidationResult {
  const applicableRules = getBondRulesForPair(
    rules,
    elementA.symbol,
    elementB.symbol,
    ageBand
  );

  if (applicableRules.length === 0) {
    return {
      valid: false,
      bondType: null,
      formalChargeA: 0,
      formalChargeB: 0,
      explanation: `${elementA.name} and ${elementB.name} do not form a bond in this lesson.`,
      geometryHint: null,
    };
  }

  const maxBondsA = getMaxBonds(elementA);
  const maxBondsB = getMaxBonds(elementB);

  // Pick the highest-slot-cost rule whose valence fits both atoms.
  // Slot cost ≈ bond order, so this implements the chemistry rule
  // "higher bond order wins when both atoms have the valence to
  // support it":
  //   * Two fresh O atoms (0 prior bonds, max 2 each) → O=O double
  //     fits (slot 2 each); single also fits but loses on cost.
  //   * Each O in peroxide H-O-O-H (1 prior H bond, 1 slot left) →
  //     double doesn't fit (1+2 > 2); single does (1+1 = 2). Single.
  //   * Fresh C-O → triple's slot 3 exceeds O's max 2 (no fit);
  //     double fits and beats single → C=O. (CO₂ uses this twice.)
  //   * Methanol H₃C-OH (C has 3 H bonds, 1 slot left) → triple and
  //     double both exceed C's free slot; single fits → C-O single.
  // This replaces the previous "first fitting rule" walk, which was
  // brittle because it depended on rules appearing in a particular
  // order in bond_rules.json.
  const fittingRules = applicableRules.filter(
    (r) =>
      existingBondsA + r.slotCostA <= maxBondsA &&
      existingBondsB + r.slotCostB <= maxBondsB
  );
  if (fittingRules.length > 0) {
    const best = fittingRules.reduce((max, r) => {
      const cost = Math.max(r.slotCostA, r.slotCostB);
      const maxCost = Math.max(max.slotCostA, max.slotCostB);
      return cost > maxCost ? r : max;
    });
    return {
      valid: true,
      bondType: best.bondType,
      formalChargeA: best.formalChargeDeltaA,
      formalChargeB: best.formalChargeDeltaB,
      explanation: `A ${best.bondType} bond forms between ${elementA.name} and ${elementB.name}.`,
      geometryHint: best.geometryHint,
    };
  }

  // Nothing fit. Use the first applicable rule (lowest-order
  // typically) to decide which atom to blame in the explanation —
  // we want to surface the side whose valence is actually exhausted.
  const ruleForExplain = applicableRules[0];
  if (existingBondsA + ruleForExplain.slotCostA > maxBondsA) {
    return {
      valid: false,
      bondType: null,
      formalChargeA: 0,
      formalChargeB: 0,
      explanation: `${elementA.name} cannot make any more bonds right now. It has used all its valence electrons.`,
      geometryHint: null,
    };
  }
  return {
    valid: false,
    bondType: null,
    formalChargeA: 0,
    formalChargeB: 0,
    explanation: `${elementB.name} cannot make any more bonds right now. It has used all its valence electrons.`,
    geometryHint: null,
  };
}

function getMaxBonds(element: Element): number {
  // Simplified main-group logic
  const valence = element.valenceElectronsMainGroup;

  if (element.category === "noble-gas") return 0;
  if (element.symbol === "H") return 1;
  if (element.symbol === "He") return 0;

  // For main group: can make up to valence bonds (donating) or 8-valence (accepting)
  // Simplified: use common oxidation state magnitude as max
  const maxOxidation = Math.max(
    ...element.commonOxidationStates.map((c) => Math.abs(c))
  );
  return maxOxidation || valence;
}

export function getBondsForAtom(
  atomId: string,
  bonds: { atomAId: string; atomBId: string; bondType: BondType }[]
): { bondType: BondType; partnerId: string }[] {
  return bonds
    .filter((b) => b.atomAId === atomId || b.atomBId === atomId)
    .map((b) => ({
      bondType: b.bondType,
      partnerId: b.atomAId === atomId ? b.atomBId : b.atomAId,
    }));
}

export function countBondOrder(
  bonds: { bondType: BondType }[]
): number {
  return bonds.reduce((sum, b) => {
    switch (b.bondType) {
      case "covalent-single":
      case "ionic":
        return sum + 1;
      case "covalent-double":
        return sum + 2;
      case "covalent-triple":
        return sum + 3;
      default:
        return sum;
    }
  }, 0);
}
