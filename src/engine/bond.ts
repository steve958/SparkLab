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

  // Pick the first matching rule (simplified for MVP)
  const rule = applicableRules[0];

  // Check valence capacity
  const maxBondsA = getMaxBonds(elementA);
  const maxBondsB = getMaxBonds(elementB);

  if (existingBondsA + rule.slotCostA > maxBondsA) {
    return {
      valid: false,
      bondType: null,
      formalChargeA: 0,
      formalChargeB: 0,
      explanation: `${elementA.name} cannot make any more bonds right now. It has used all its valence electrons.`,
      geometryHint: null,
    };
  }

  if (existingBondsB + rule.slotCostB > maxBondsB) {
    return {
      valid: false,
      bondType: null,
      formalChargeA: 0,
      formalChargeB: 0,
      explanation: `${elementB.name} cannot make any more bonds right now. It has used all its valence electrons.`,
      geometryHint: null,
    };
  }

  return {
    valid: true,
    bondType: rule.bondType,
    formalChargeA: rule.formalChargeDeltaA,
    formalChargeB: rule.formalChargeDeltaB,
    explanation: `A ${rule.bondType} bond forms between ${elementA.name} and ${elementB.name}.`,
    geometryHint: rule.geometryHint,
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
