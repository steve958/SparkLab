import { describe, it, expect } from "vitest";
import { buildAtom, getExpectedBondCount } from "@/engine/atom";
import { validateBond, countBondOrder } from "@/engine/bond";
import { validateSceneMolecule, validateSceneMolecules } from "@/engine/molecule";
import { validateAtomConservation, validateReactionMission } from "@/engine/reaction";
import { calculateScore } from "@/engine/scoring";
import type { Element, BondRule, SceneAtom, SceneBond, Molecule, Reaction } from "@/types";

const testElements: Element[] = [
  {
    atomicNumber: 1,
    symbol: "H",
    name: "Hydrogen",
    group: 1,
    period: 1,
    block: "s",
    category: "nonmetal",
    standardAtomicWeight: 1.008,
    stateAtStp: "gas",
    shellOccupancy: [1],
    valenceElectronsMainGroup: 1,
    commonOxidationStates: [1, -1],
    electronegativityPauling: 2.2,
    colorToken: "#3b82f6",
    iconAsset: null,
    unlockWorld: "foundations",
    factCardKey: "fact_hydrogen",
    sourceRef: "NIST",
  },
  {
    atomicNumber: 8,
    symbol: "O",
    name: "Oxygen",
    group: 16,
    period: 2,
    block: "p",
    category: "nonmetal",
    standardAtomicWeight: 15.999,
    stateAtStp: "gas",
    shellOccupancy: [2, 6],
    valenceElectronsMainGroup: 6,
    commonOxidationStates: [-2],
    electronegativityPauling: 3.44,
    colorToken: "#ef4444",
    iconAsset: null,
    unlockWorld: "foundations",
    factCardKey: "fact_oxygen",
    sourceRef: "NIST",
  },
  {
    atomicNumber: 11,
    symbol: "Na",
    name: "Sodium",
    group: 1,
    period: 3,
    block: "s",
    category: "alkali-metal",
    standardAtomicWeight: 22.99,
    stateAtStp: "solid",
    shellOccupancy: [2, 8, 1],
    valenceElectronsMainGroup: 1,
    commonOxidationStates: [1],
    electronegativityPauling: 0.93,
    colorToken: "#dc2626",
    iconAsset: null,
    unlockWorld: "core",
    factCardKey: "fact_sodium",
    sourceRef: "NIST",
  },
];

const testBondRules: BondRule[] = [
  {
    ruleId: "h-o-single",
    ageBand: "8-10",
    atomA: "H",
    atomB: "O",
    bondType: "covalent-single",
    maxOrder: 1,
    slotCostA: 1,
    slotCostB: 1,
    formalChargeDeltaA: 0,
    formalChargeDeltaB: 0,
    geometryHint: null,
    allowedWorlds: ["foundations"],
    explanationKey: "hint_h_o_bond",
  },
];

describe("Atom Engine", () => {
  it("builds a neutral hydrogen atom correctly", () => {
    const result = buildAtom(testElements, 1, 0, 1);
    expect(result.element.symbol).toBe("H");
    expect(result.charge).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it("detects invalid proton count", () => {
    const result = buildAtom(testElements, 99, 0, 99);
    expect(result.isValid).toBe(false);
  });

  it("calculates expected bond counts", () => {
    const h = testElements.find((e) => e.symbol === "H")!;
    const o = testElements.find((e) => e.symbol === "O")!;
    expect(getExpectedBondCount(h)).toBe(1);
    expect(getExpectedBondCount(o)).toBe(2);
  });
});

describe("Bond Engine", () => {
  it("validates H-O bond for age 8-10", () => {
    const h = testElements.find((e) => e.symbol === "H")!;
    const o = testElements.find((e) => e.symbol === "O")!;
    const result = validateBond(testBondRules, h, o, "8-10", 0, 0);
    expect(result.valid).toBe(true);
    expect(result.bondType).toBe("covalent-single");
  });

  it("rejects invalid element pair", () => {
    const h = testElements.find((e) => e.symbol === "H")!;
    const na = testElements.find((e) => e.symbol === "Na")!;
    const result = validateBond(testBondRules, h, na, "8-10", 0, 0);
    expect(result.valid).toBe(false);
  });

  it("counts bond orders correctly", () => {
    const bonds: { bondType: SceneBond["bondType"] }[] = [
      { bondType: "covalent-single" },
      { bondType: "covalent-double" },
      { bondType: "covalent-triple" },
      { bondType: "ionic" },
    ];
    expect(countBondOrder(bonds)).toBe(7);
  });

  // O-O has both an `o-o-double` and an `o-o-single` rule. The double
  // is listed first, so two fresh oxygens (no prior bonds, max 2 each)
  // should get the chemically-correct O=O double bond. If either
  // oxygen is already bonded once (e.g. peroxide H-O-O-H, where each
  // O has one H bond), the double's slotCost = 2 won't fit and the
  // engine should fall through to the single rule rather than
  // refusing the bond.
  it("picks O=O double for two fresh oxygens", () => {
    const oxygen: Element = {
      atomicNumber: 8,
      symbol: "O",
      name: "Oxygen",
      group: 16,
      period: 2,
      block: "p",
      category: "nonmetal",
      standardAtomicWeight: 15.999,
      stateAtStp: "gas",
      shellOccupancy: [2, 6],
      valenceElectronsMainGroup: 6,
      commonOxidationStates: [-2],
      electronegativityPauling: 3.44,
      colorToken: "#ef4444",
      iconAsset: null,
      unlockWorld: "foundations",
      factCardKey: "fact_oxygen",
      sourceRef: "NIST",
    };
    const ooRules: BondRule[] = [
      {
        ruleId: "o-o-double",
        ageBand: "8-10",
        atomA: "O",
        atomB: "O",
        bondType: "covalent-double",
        maxOrder: 2,
        slotCostA: 2,
        slotCostB: 2,
        formalChargeDeltaA: 0,
        formalChargeDeltaB: 0,
        geometryHint: null,
        allowedWorlds: ["foundations"],
        explanationKey: "hint_o_o_double",
      },
      {
        ruleId: "o-o-single",
        ageBand: "8-10",
        atomA: "O",
        atomB: "O",
        bondType: "covalent-single",
        maxOrder: 2,
        slotCostA: 1,
        slotCostB: 1,
        formalChargeDeltaA: 0,
        formalChargeDeltaB: 0,
        geometryHint: null,
        allowedWorlds: ["foundations"],
        explanationKey: "hint_o_o_single",
      },
    ];

    const fresh = validateBond(ooRules, oxygen, oxygen, "8-10", 0, 0);
    expect(fresh.valid).toBe(true);
    expect(fresh.bondType).toBe("covalent-double");
  });

  it("falls through to O-O single when each O already has one bond (peroxide)", () => {
    const oxygen: Element = {
      atomicNumber: 8,
      symbol: "O",
      name: "Oxygen",
      group: 16,
      period: 2,
      block: "p",
      category: "nonmetal",
      standardAtomicWeight: 15.999,
      stateAtStp: "gas",
      shellOccupancy: [2, 6],
      valenceElectronsMainGroup: 6,
      commonOxidationStates: [-2],
      electronegativityPauling: 3.44,
      colorToken: "#ef4444",
      iconAsset: null,
      unlockWorld: "foundations",
      factCardKey: "fact_oxygen",
      sourceRef: "NIST",
    };
    const ooRules: BondRule[] = [
      {
        ruleId: "o-o-double",
        ageBand: "8-10",
        atomA: "O",
        atomB: "O",
        bondType: "covalent-double",
        maxOrder: 2,
        slotCostA: 2,
        slotCostB: 2,
        formalChargeDeltaA: 0,
        formalChargeDeltaB: 0,
        geometryHint: null,
        allowedWorlds: ["foundations"],
        explanationKey: "hint_o_o_double",
      },
      {
        ruleId: "o-o-single",
        ageBand: "8-10",
        atomA: "O",
        atomB: "O",
        bondType: "covalent-single",
        maxOrder: 2,
        slotCostA: 1,
        slotCostB: 1,
        formalChargeDeltaA: 0,
        formalChargeDeltaB: 0,
        geometryHint: null,
        allowedWorlds: ["foundations"],
        explanationKey: "hint_o_o_single",
      },
    ];

    const peroxide = validateBond(ooRules, oxygen, oxygen, "8-10", 1, 1);
    expect(peroxide.valid).toBe(true);
    expect(peroxide.bondType).toBe("covalent-single");
  });
});

describe("Molecule Engine", () => {
  it("matches a water molecule", () => {
    const atoms: SceneAtom[] = [
      { id: "a1", elementId: "O", x: 0, y: 0, protons: 8, neutrons: 8, electrons: 8 },
      { id: "a2", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "a3", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
    ];
    const bonds: SceneBond[] = [
      { id: "b1", atomAId: "a1", atomBId: "a2", bondType: "covalent-single" },
      { id: "b2", atomAId: "a1", atomBId: "a3", bondType: "covalent-single" },
    ];

    const result = validateSceneMolecule([], atoms, bonds);
    // No molecules in empty array, so should not match
    expect(result.matches).toBe(false);
  });

  it("detects disconnected atoms", () => {
    const atoms: SceneAtom[] = [
      { id: "a1", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "a2", elementId: "H", x: 100, y: 0, protons: 1, neutrons: 0, electrons: 1 },
    ];
    const bonds: SceneBond[] = [];

    const result = validateSceneMolecule([], atoms, bonds);
    expect(result.matches).toBe(false);
    expect(result.explanation.toLowerCase()).toContain("not all connected");
  });

  // Multi-molecule missions (e.g. "Ionic vs Covalent": water + NaCl)
  // expect the scene to contain *multiple* disconnected molecules.
  // The single-molecule validator surfaces "atoms not all connected"
  // for a correctly-built scene, which is chemistry-wrong (you don't
  // bond Na to H₂O). validateSceneMolecules must accept the scene as
  // long as each required molecule appears as its own component.
  it("validateSceneMolecules accepts disconnected required molecules", () => {
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
    } as unknown as Molecule;
    const nacl: Molecule = {
      moleculeId: "sodium_chloride",
      displayName: "Sodium Chloride",
      formulaHill: "NaCl",
      ageBand: "11-14",
      allowedBondGraph: {
        nodes: [
          { elementId: "Na", label: "Na" },
          { elementId: "Cl", label: "Cl" },
        ],
        edges: [{ from: 0, to: 1, type: "ionic" }],
      },
      synonyms: [],
      difficulty: 3,
      uses3dTemplate: false,
      factKey: "fact_sodium_chloride",
    } as unknown as Molecule;

    const atoms: SceneAtom[] = [
      // Water on the left
      { id: "o1", elementId: "O", x: 100, y: 100, protons: 8, neutrons: 8, electrons: 8 },
      { id: "h1", elementId: "H", x: 80, y: 130, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h2", elementId: "H", x: 120, y: 130, protons: 1, neutrons: 0, electrons: 1 },
      // NaCl on the right (intentionally NOT bonded to the water)
      { id: "na1", elementId: "Na", x: 400, y: 100, protons: 11, neutrons: 12, electrons: 11 },
      { id: "cl1", elementId: "Cl", x: 440, y: 100, protons: 17, neutrons: 18, electrons: 17 },
    ];
    const bonds: SceneBond[] = [
      { id: "b1", atomAId: "o1", atomBId: "h1", bondType: "covalent-single" },
      { id: "b2", atomAId: "o1", atomBId: "h2", bondType: "covalent-single" },
      { id: "b3", atomAId: "na1", atomBId: "cl1", bondType: "ionic" },
    ];

    const result = validateSceneMolecules(
      [water, nacl],
      ["water", "sodium_chloride"],
      atoms,
      bonds
    );
    expect(result.matches).toBe(true);
    expect(result.matchedMoleculeIds.sort()).toEqual([
      "sodium_chloride",
      "water",
    ]);
    expect(result.missingMoleculeIds).toEqual([]);
  });

  it("validateSceneMolecules reports missing required molecules by display name", () => {
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
    } as unknown as Molecule;
    const nacl: Molecule = {
      moleculeId: "sodium_chloride",
      displayName: "Sodium Chloride",
      formulaHill: "NaCl",
      ageBand: "11-14",
      allowedBondGraph: {
        nodes: [
          { elementId: "Na", label: "Na" },
          { elementId: "Cl", label: "Cl" },
        ],
        edges: [{ from: 0, to: 1, type: "ionic" }],
      },
      synonyms: [],
      difficulty: 3,
      uses3dTemplate: false,
      factKey: "fact_sodium_chloride",
    } as unknown as Molecule;

    // Player built water but not NaCl yet.
    const atoms: SceneAtom[] = [
      { id: "o1", elementId: "O", x: 100, y: 100, protons: 8, neutrons: 8, electrons: 8 },
      { id: "h1", elementId: "H", x: 80, y: 130, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h2", elementId: "H", x: 120, y: 130, protons: 1, neutrons: 0, electrons: 1 },
    ];
    const bonds: SceneBond[] = [
      { id: "b1", atomAId: "o1", atomBId: "h1", bondType: "covalent-single" },
      { id: "b2", atomAId: "o1", atomBId: "h2", bondType: "covalent-single" },
    ];

    const result = validateSceneMolecules(
      [water, nacl],
      ["water", "sodium_chloride"],
      atoms,
      bonds
    );
    expect(result.matches).toBe(false);
    expect(result.missingMoleculeIds).toEqual(["sodium_chloride"]);
    expect(result.explanation).toContain("Sodium Chloride");
    // The player should never see "atoms not all connected" for a
    // correctly-built water on its own — that wording belongs to
    // single-molecule missions only.
    expect(result.explanation.toLowerCase()).not.toContain("not all connected");
  });

  // Regression: the previous isomorphism implementation capped at
  // n=6 and silently failed on any larger molecule. Ethane is the
  // smallest curriculum molecule above that cap (2 C + 6 H = 8
  // atoms). This test would have returned matches=false under the
  // old algorithm; the backtracking + degree-pruning replacement
  // should match it correctly.
  it("validateSceneMolecules matches an 8-atom molecule (ethane)", () => {
    const ethane: Molecule = {
      moleculeId: "ethane",
      displayName: "Ethane",
      formulaHill: "C2H6",
      ageBand: "11-14",
      allowedBondGraph: {
        nodes: [
          { elementId: "C", label: "C1" },
          { elementId: "C", label: "C2" },
          { elementId: "H", label: "H1" },
          { elementId: "H", label: "H2" },
          { elementId: "H", label: "H3" },
          { elementId: "H", label: "H4" },
          { elementId: "H", label: "H5" },
          { elementId: "H", label: "H6" },
        ],
        edges: [
          { from: 0, to: 1, type: "covalent-single" },
          { from: 0, to: 2, type: "covalent-single" },
          { from: 0, to: 3, type: "covalent-single" },
          { from: 0, to: 4, type: "covalent-single" },
          { from: 1, to: 5, type: "covalent-single" },
          { from: 1, to: 6, type: "covalent-single" },
          { from: 1, to: 7, type: "covalent-single" },
        ],
      },
      synonyms: [],
      difficulty: 4,
      uses3dTemplate: false,
      factKey: "fact_ethane",
    } as unknown as Molecule;

    const atoms: SceneAtom[] = [
      { id: "c1", elementId: "C", x: 0, y: 0, protons: 6, neutrons: 6, electrons: 6 },
      { id: "c2", elementId: "C", x: 50, y: 0, protons: 6, neutrons: 6, electrons: 6 },
      { id: "h1", elementId: "H", x: -20, y: -20, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h2", elementId: "H", x: -20, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h3", elementId: "H", x: -20, y: 20, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h4", elementId: "H", x: 70, y: -20, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h5", elementId: "H", x: 70, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h6", elementId: "H", x: 70, y: 20, protons: 1, neutrons: 0, electrons: 1 },
    ];
    const bonds: SceneBond[] = [
      { id: "b1", atomAId: "c1", atomBId: "c2", bondType: "covalent-single" },
      { id: "b2", atomAId: "c1", atomBId: "h1", bondType: "covalent-single" },
      { id: "b3", atomAId: "c1", atomBId: "h2", bondType: "covalent-single" },
      { id: "b4", atomAId: "c1", atomBId: "h3", bondType: "covalent-single" },
      { id: "b5", atomAId: "c2", atomBId: "h4", bondType: "covalent-single" },
      { id: "b6", atomAId: "c2", atomBId: "h5", bondType: "covalent-single" },
      { id: "b7", atomAId: "c2", atomBId: "h6", bondType: "covalent-single" },
    ];

    const result = validateSceneMolecules(
      [ethane],
      ["ethane"],
      atoms,
      bonds
    );
    expect(result.matches).toBe(true);
    expect(result.matchedMoleculeIds).toEqual(["ethane"]);
  });
});

describe("Reaction Engine", () => {
  it("validates atom conservation", () => {
    const reactants: SceneAtom[] = [
      { id: "r1", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "r2", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "r3", elementId: "O", x: 0, y: 0, protons: 8, neutrons: 8, electrons: 8 },
    ];
    const products: SceneAtom[] = [
      { id: "p1", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "p2", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "p3", elementId: "O", x: 0, y: 0, protons: 8, neutrons: 8, electrons: 8 },
    ];

    const result = validateAtomConservation(reactants, products);
    expect(result.conserved).toBe(true);
    expect(result.reactantCounts["H"]).toBe(2);
    expect(result.productCounts["H"]).toBe(2);
  });

  it("detects non-conservation", () => {
    const reactants: SceneAtom[] = [
      { id: "r1", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
    ];
    const products: SceneAtom[] = [
      { id: "p1", elementId: "O", x: 0, y: 0, protons: 8, neutrons: 8, electrons: 8 },
    ];

    const result = validateAtomConservation(reactants, products);
    expect(result.conserved).toBe(false);
  });
});

const testMolecules: Molecule[] = [
  {
    moleculeId: "water",
    displayName: "Water",
    formulaHill: "H2O",
    ageBand: "8-10",
    allowedBondGraph: {
      nodes: [{ elementId: "O" }, { elementId: "H" }, { elementId: "H" }],
      edges: [
        { from: 0, to: 1, type: "covalent-single" },
        { from: 0, to: 2, type: "covalent-single" },
      ],
    },
    synonyms: [],
    difficulty: 1,
    uses3dTemplate: false,
    factKey: "fact_water",
  },
  {
    moleculeId: "hydrogen_gas",
    displayName: "Hydrogen Gas",
    formulaHill: "H2",
    ageBand: "8-10",
    allowedBondGraph: {
      nodes: [{ elementId: "H" }, { elementId: "H" }],
      edges: [{ from: 0, to: 1, type: "covalent-single" }],
    },
    synonyms: [],
    difficulty: 1,
    uses3dTemplate: false,
    factKey: "fact_hydrogen_gas",
  },
  {
    moleculeId: "oxygen_gas",
    displayName: "Oxygen Gas",
    formulaHill: "O2",
    ageBand: "8-10",
    allowedBondGraph: {
      nodes: [{ elementId: "O" }, { elementId: "O" }],
      edges: [{ from: 0, to: 1, type: "covalent-double" }],
    },
    synonyms: [],
    difficulty: 2,
    uses3dTemplate: false,
    factKey: "fact_oxygen_gas",
  },
];

const waterFormationReaction: Reaction = {
  reactionId: "water_formation",
  ageBand: "8-10",
  reactants: [
    { moleculeId: "hydrogen_gas", coefficient: 2 },
    { moleculeId: "oxygen_gas", coefficient: 1 },
  ],
  products: [{ moleculeId: "water", coefficient: 2 }],
  conditionTags: ["spark"],
  conservationSignature: { H: 4, O: 2 },
  equationDisplay: "2H₂ + O₂ → 2H₂O",
  animationTemplate: "combustion",
  energyChangeLabel: "exothermic",
  standardsTags: ["NGSS-5-PS1-4"],
};

describe("Reaction Mission Validation", () => {
  it("passes for correct water formation reaction", () => {
    // 2 H2 + O2 -> 2 H2O
    // Reactants (left of center=400): 2 H2 + 1 O2 = 4H + 2O
    const atoms: SceneAtom[] = [
      // H2 molecule 1 (reactant)
      { id: "h1", elementId: "H", x: 100, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h2", elementId: "H", x: 150, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      // H2 molecule 2 (reactant)
      { id: "h3", elementId: "H", x: 100, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h4", elementId: "H", x: 150, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      // O2 molecule (reactant)
      { id: "o1", elementId: "O", x: 250, y: 150, protons: 8, neutrons: 8, electrons: 8 },
      { id: "o2", elementId: "O", x: 300, y: 150, protons: 8, neutrons: 8, electrons: 8 },
      // H2O molecule 1 (product)
      { id: "h5", elementId: "H", x: 500, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h6", elementId: "H", x: 550, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "o3", elementId: "O", x: 525, y: 100, protons: 8, neutrons: 8, electrons: 8 },
      // H2O molecule 2 (product)
      { id: "h7", elementId: "H", x: 500, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h8", elementId: "H", x: 550, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      { id: "o4", elementId: "O", x: 525, y: 200, protons: 8, neutrons: 8, electrons: 8 },
    ];

    const bonds: SceneBond[] = [
      // H2 bonds (reactants)
      { id: "b1", atomAId: "h1", atomBId: "h2", bondType: "covalent-single" },
      { id: "b2", atomAId: "h3", atomBId: "h4", bondType: "covalent-single" },
      // O2 bond (reactant)
      { id: "b3", atomAId: "o1", atomBId: "o2", bondType: "covalent-double" },
      // H2O bonds (products)
      { id: "b4", atomAId: "o3", atomBId: "h5", bondType: "covalent-single" },
      { id: "b5", atomAId: "o3", atomBId: "h6", bondType: "covalent-single" },
      { id: "b6", atomAId: "o4", atomBId: "h7", bondType: "covalent-single" },
      { id: "b7", atomAId: "o4", atomBId: "h8", bondType: "covalent-single" },
    ];

    const result = validateReactionMission(
      waterFormationReaction,
      testMolecules,
      atoms,
      bonds,
      400
    );

    expect(result.success).toBe(true);
    expect(result.conservation.conserved).toBe(true);
    expect(result.productsValid).toBe(true);
    expect(result.reactantsValid).toBe(true);
  });

  it("fails when atoms are not conserved", () => {
    const atoms: SceneAtom[] = [
      // Only 1 H2 on reactant side = 2H
      { id: "h1", elementId: "H", x: 100, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h2", elementId: "H", x: 150, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      // O2 on reactant side = 2O
      { id: "o1", elementId: "O", x: 250, y: 150, protons: 8, neutrons: 8, electrons: 8 },
      { id: "o2", elementId: "O", x: 300, y: 150, protons: 8, neutrons: 8, electrons: 8 },
      // 2 H2O on product side = 4H + 2O (needs 4H, only have 2H)
      { id: "h3", elementId: "H", x: 500, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h4", elementId: "H", x: 550, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "o3", elementId: "O", x: 525, y: 100, protons: 8, neutrons: 8, electrons: 8 },
      { id: "h5", elementId: "H", x: 500, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h6", elementId: "H", x: 550, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      { id: "o4", elementId: "O", x: 525, y: 200, protons: 8, neutrons: 8, electrons: 8 },
    ];

    const bonds: SceneBond[] = [
      { id: "b1", atomAId: "h1", atomBId: "h2", bondType: "covalent-single" },
      { id: "b2", atomAId: "o1", atomBId: "o2", bondType: "covalent-double" },
      { id: "b3", atomAId: "o3", atomBId: "h3", bondType: "covalent-single" },
      { id: "b4", atomAId: "o3", atomBId: "h4", bondType: "covalent-single" },
      { id: "b5", atomAId: "o4", atomBId: "h5", bondType: "covalent-single" },
      { id: "b6", atomAId: "o4", atomBId: "h6", bondType: "covalent-single" },
    ];

    const result = validateReactionMission(
      waterFormationReaction,
      testMolecules,
      atoms,
      bonds,
      400
    );

    expect(result.success).toBe(false);
    expect(result.conservation.conserved).toBe(false);
  });

  it("fails when product molecules are wrong", () => {
    // Correct atom counts but wrong molecule structure on product side
    const atoms: SceneAtom[] = [
      // 2 H2 + O2 on reactant side
      { id: "h1", elementId: "H", x: 100, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h2", elementId: "H", x: 150, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h3", elementId: "H", x: 100, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h4", elementId: "H", x: 150, y: 200, protons: 1, neutrons: 0, electrons: 1 },
      { id: "o1", elementId: "O", x: 250, y: 150, protons: 8, neutrons: 8, electrons: 8 },
      { id: "o2", elementId: "O", x: 300, y: 150, protons: 8, neutrons: 8, electrons: 8 },
      // Product side: correct counts (4H + 2O) but as H2 + O2 instead of 2 H2O
      { id: "h5", elementId: "H", x: 500, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h6", elementId: "H", x: 550, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "o3", elementId: "O", x: 500, y: 200, protons: 8, neutrons: 8, electrons: 8 },
      { id: "o4", elementId: "O", x: 550, y: 200, protons: 8, neutrons: 8, electrons: 8 },
      { id: "h7", elementId: "H", x: 600, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h8", elementId: "H", x: 650, y: 100, protons: 1, neutrons: 0, electrons: 1 },
    ];

    const bonds: SceneBond[] = [
      // Reactant bonds
      { id: "b1", atomAId: "h1", atomBId: "h2", bondType: "covalent-single" },
      { id: "b2", atomAId: "h3", atomBId: "h4", bondType: "covalent-single" },
      { id: "b3", atomAId: "o1", atomBId: "o2", bondType: "covalent-double" },
      // Product bonds: H2 + O2 + H2 (not 2 H2O)
      { id: "b4", atomAId: "h5", atomBId: "h6", bondType: "covalent-single" },
      { id: "b5", atomAId: "o3", atomBId: "o4", bondType: "covalent-double" },
      { id: "b6", atomAId: "h7", atomBId: "h8", bondType: "covalent-single" },
    ];

    const result = validateReactionMission(
      waterFormationReaction,
      testMolecules,
      atoms,
      bonds,
      400
    );

    expect(result.success).toBe(false);
    expect(result.conservation.conserved).toBe(true);
    expect(result.productsValid).toBe(false);
  });

  it("fails with empty product side", () => {
    const atoms: SceneAtom[] = [
      { id: "h1", elementId: "H", x: 100, y: 100, protons: 1, neutrons: 0, electrons: 1 },
      { id: "h2", elementId: "H", x: 150, y: 100, protons: 1, neutrons: 0, electrons: 1 },
    ];
    const bonds: SceneBond[] = [
      { id: "b1", atomAId: "h1", atomBId: "h2", bondType: "covalent-single" },
    ];

    const result = validateReactionMission(
      waterFormationReaction,
      testMolecules,
      atoms,
      bonds,
      400
    );

    expect(result.success).toBe(false);
    expect(result.productsValid).toBe(false);
  });

  // Regression: on a narrow viewport (or with a stale centerX prop in
  // the AtomLedger), atom.x for "products" spawns can land below the
  // partition's centerX and get misclassified as reactants. The stamped
  // `side` field bypasses that — atoms placed via the Products tray
  // button must be counted as products even when their x sits on the
  // wrong side of centerX.
  it("uses stamped side over position when both disagree", () => {
    // All atoms placed at x = 100, well below centerX = 400, so a
    // pure position-based partition would put everything on the
    // reactants side. The `side` field overrides that.
    const atoms: SceneAtom[] = [
      // Reactants: 2 H2 + O2
      { id: "h1", elementId: "H", x: 100, y: 100, protons: 1, neutrons: 0, electrons: 1, side: "reactants" },
      { id: "h2", elementId: "H", x: 100, y: 110, protons: 1, neutrons: 0, electrons: 1, side: "reactants" },
      { id: "h3", elementId: "H", x: 100, y: 120, protons: 1, neutrons: 0, electrons: 1, side: "reactants" },
      { id: "h4", elementId: "H", x: 100, y: 130, protons: 1, neutrons: 0, electrons: 1, side: "reactants" },
      { id: "o1", elementId: "O", x: 100, y: 140, protons: 8, neutrons: 8, electrons: 8, side: "reactants" },
      { id: "o2", elementId: "O", x: 100, y: 150, protons: 8, neutrons: 8, electrons: 8, side: "reactants" },
      // Products: 2 H2O — also placed at x = 100, but stamped "products"
      { id: "h5", elementId: "H", x: 100, y: 200, protons: 1, neutrons: 0, electrons: 1, side: "products" },
      { id: "h6", elementId: "H", x: 100, y: 210, protons: 1, neutrons: 0, electrons: 1, side: "products" },
      { id: "o3", elementId: "O", x: 100, y: 220, protons: 8, neutrons: 8, electrons: 8, side: "products" },
      { id: "h7", elementId: "H", x: 100, y: 230, protons: 1, neutrons: 0, electrons: 1, side: "products" },
      { id: "h8", elementId: "H", x: 100, y: 240, protons: 1, neutrons: 0, electrons: 1, side: "products" },
      { id: "o4", elementId: "O", x: 100, y: 250, protons: 8, neutrons: 8, electrons: 8, side: "products" },
    ];
    const bonds: SceneBond[] = [
      { id: "b1", atomAId: "h1", atomBId: "h2", bondType: "covalent-single" },
      { id: "b2", atomAId: "h3", atomBId: "h4", bondType: "covalent-single" },
      { id: "b3", atomAId: "o1", atomBId: "o2", bondType: "covalent-double" },
      { id: "b4", atomAId: "o3", atomBId: "h5", bondType: "covalent-single" },
      { id: "b5", atomAId: "o3", atomBId: "h6", bondType: "covalent-single" },
      { id: "b6", atomAId: "o4", atomBId: "h7", bondType: "covalent-single" },
      { id: "b7", atomAId: "o4", atomBId: "h8", bondType: "covalent-single" },
    ];

    const result = validateReactionMission(
      waterFormationReaction,
      testMolecules,
      atoms,
      bonds,
      400 // would misclassify everyone as reactants without the side field
    );

    expect(result.success).toBe(true);
    expect(result.conservation.conserved).toBe(true);
    expect(result.productsValid).toBe(true);
    expect(result.reactantsValid).toBe(true);
  });
});

describe("Scoring Engine", () => {
  it("gives 3 stars for perfect completion", () => {
    const result = calculateScore(true, 0, true, 1);
    expect(result.stars).toBe(3);
    expect(result.independenceScore).toBe(1);
  });

  it("gives 1 star for correct with hints", () => {
    const result = calculateScore(true, 2, false, 1);
    expect(result.stars).toBe(1);
  });

  it("gives 0 stars for incorrect", () => {
    const result = calculateScore(false, 0, null, 1);
    expect(result.stars).toBe(0);
  });

  it("penalizes many attempts", () => {
    const result = calculateScore(true, 0, true, 5);
    expect(result.stars).toBe(2); // capped at 2 due to attempts > 3
  });
});
