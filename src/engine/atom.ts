import type { Element } from "@/types";
import { getElementBySymbol } from "@/data/loader";

export interface AtomStructure {
  element: Element;
  protons: number;
  neutrons: number;
  electrons: number;
  charge: number;
  massNumber: number;
  isValid: boolean;
  explanation: string;
}

export function buildAtom(
  elements: Element[],
  protons: number,
  neutrons: number,
  electrons: number
): AtomStructure {
  const element = elements.find((e) => e.atomicNumber === protons);

  if (!element) {
    return {
      element: elements[0], // fallback
      protons,
      neutrons,
      electrons,
      charge: electrons - protons,
      massNumber: protons + neutrons,
      isValid: false,
      explanation: `There is no element with ${protons} protons. Check the periodic table!`,
    };
  }

  const charge = electrons - protons;
  const massNumber = protons + neutrons;
  const commonCharges = element.commonOxidationStates;
  // Neutral atoms (charge 0) are always valid; otherwise check common oxidation states
  const isChargeValid = charge === 0 || commonCharges.includes(charge);

  let explanation: string;
  if (isChargeValid) {
    explanation = `${element.name} has ${protons} protons. With ${electrons} electrons, its charge is ${charge > 0 ? "+" : ""}${charge}. This is a common state for ${element.name}.`;
  } else {
    explanation = `${element.name} usually has charges like ${commonCharges.join(", ")}. A charge of ${charge} is unusual for this element.`;
  }

  return {
    element,
    protons,
    neutrons,
    electrons,
    charge,
    massNumber,
    isValid: isChargeValid,
    explanation,
  };
}

export function getValenceElectrons(element: Element): number {
  return element.valenceElectronsMainGroup;
}

export function getElectronShells(element: Element): number[] {
  return element.shellOccupancy;
}

export function getExpectedBondCount(element: Element): number {
  // Simplified main-group octet rule
  const valence = element.valenceElectronsMainGroup;
  if (element.category === "noble-gas") return 0;
  if (element.symbol === "H" || element.symbol === "He") {
    return valence === 1 ? 1 : 0;
  }
  return Math.min(valence, 8 - valence);
}
