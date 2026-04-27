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

  // Walk the applicable rules in declared order — bond_rules.json
  // lists higher-order forms first for pairs that have multiple
  // (e.g. o-o-double before o-o-single, c-o-double before c-o-single
  // at age 11-14) — and pick the first whose slot cost actually fits
  // the available valence on both atoms. That way:
  //   * Two fresh O atoms (0 prior bonds, max 2 each) form O=O
  //     because the double rule passes.
  //   * Each O in peroxide H-O-O-H (1 prior H bond, 1 slot left)
  //     fails the double's slotCost = 2 check and falls through to
  //     the single rule, giving the correct H-O-O-H structure.
  // If every rule fails the valence check, surface the failure for
  // the highest-order rule (most likely the player's actual ceiling).
  for (const rule of applicableRules) {
    const fitsA = existingBondsA + rule.slotCostA <= maxBondsA;
    const fitsB = existingBondsB + rule.slotCostB <= maxBondsB;
    if (fitsA && fitsB) {
      return {
        valid: true,
        bondType: rule.bondType,
        formalChargeA: rule.formalChargeDeltaA,
        formalChargeB: rule.formalChargeDeltaB,
        explanation: `A ${rule.bondType} bond forms between ${elementA.name} and ${elementB.name}.`,
        geometryHint: rule.geometryHint,
      };
    }
  }

  // Nothing fit. Use the first rule (highest-order) to choose which
  // atom to blame in the explanation — its slotCost is what the
  // player would have needed.
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
