import { afterEach, describe, expect, it } from "vitest";
import { clearContentCache, getElementBySymbol, getMoleculeById, getString, loadContent } from "@/data/loader";
import type { BondRule, Element, LocalizedString, Mission, Molecule, Reaction, World } from "@/types";

function elementSeed(overrides: Partial<Element> = {}): Element {
  return {
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
    unlockWorld: "encyclopedia",
    factCardKey: "fact_h",
    sourceRef: "NIST",
    ...overrides,
  } as Element;
}

function moleculeSeed(id: string, atoms: { elementId: string; count: number }[] = [{ elementId: "H", count: 2 }]): Molecule {
  return {
    moleculeId: id,
    formula: "H2",
    displayName: "test",
    atoms,
    bonds: [],
    layoutHint: "linear",
    factCardKey: "fact",
  } as unknown as Molecule;
}

function missionSeed(overrides: Partial<Mission> = {}): Mission {
  return {
    missionId: "m1",
    worldId: "w1",
    title: "t",
    brief: "",
    objectiveType: "build-molecule",
    allowedElements: ["H"],
    allowedMolecules: ["water"],
    successConditions: [{ type: "build-molecule", targetMoleculeId: "water" }],
    hintSetId: "h",
    estimatedMinutes: 1,
    standardsTags: [],
    teacherNotes: "",
    difficulty: 1,
    ageBand: "8-10",
    prerequisites: [],
    ...overrides,
  };
}

function bundle(parts: Partial<{
  elements: Element[];
  molecules: Molecule[];
  bondRules: BondRule[];
  reactions: Reaction[];
  missions: Mission[];
  worlds: World[];
  strings: LocalizedString[];
  badges: unknown[];
  masteryChecks: unknown[];
}> = {}) {
  return {
    elements: parts.elements ?? [elementSeed()],
    molecules: parts.molecules ?? [moleculeSeed("water")],
    bondRules: parts.bondRules ?? [],
    reactions: parts.reactions ?? [],
    missions: parts.missions ?? [],
    worlds: parts.worlds ?? [{ worldId: "w1" } as unknown as World],
    strings: parts.strings ?? [],
    badges: parts.badges ?? [],
    masteryChecks: parts.masteryChecks ?? [],
  };
}

function stubFetch(b: ReturnType<typeof bundle>) {
  const map: Record<string, unknown> = {
    "/data/elements.json": b.elements,
    "/data/bond_rules.json": b.bondRules,
    "/data/molecules.json": b.molecules,
    "/data/reactions.json": b.reactions,
    "/data/missions.json": b.missions,
    "/data/worlds.json": b.worlds,
    "/data/strings.json": b.strings,
    "/data/badges.json": b.badges,
    "/data/mastery_checks.json": b.masteryChecks,
  };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const data = map[url];
    if (data === undefined) throw new Error(`unexpected fetch ${url}`);
    return new Response(JSON.stringify(data), { status: 200 });
  }) as typeof fetch;
}

describe("loader / validateBundle", () => {
  afterEach(() => {
    clearContentCache();
  });

  it("loadContent returns the parsed bundle on a clean dataset", async () => {
    stubFetch(bundle());
    const c = await loadContent();
    expect(c.elements).toHaveLength(1);
    expect(c.molecules).toHaveLength(1);
  });

  it("loadContent caches the bundle across calls", async () => {
    let calls = 0;
    stubFetch(bundle());
    const original = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof original>) => {
      calls += 1;
      return original(...args);
    }) as typeof fetch;

    await loadContent();
    await loadContent();
    expect(calls).toBe(9); // one per data file, only on the first call
  });

  it("rejects when two elements share a symbol", async () => {
    stubFetch(bundle({ elements: [elementSeed(), elementSeed({ atomicNumber: 2 })] }));
    await expect(loadContent()).rejects.toThrow(/Duplicate element symbol/);
  });

  it("rejects when bond rules reference unknown elements", async () => {
    stubFetch(
      bundle({
        bondRules: [
          { ruleId: "r1", atomA: "H", atomB: "Z", validType: "covalent-single", ageBand: "8-10" } as unknown as BondRule,
        ],
      })
    );
    await expect(loadContent()).rejects.toThrow(/references unknown element/);
  });

  it("rejects when a mission references an unknown world", async () => {
    stubFetch(
      bundle({
        missions: [missionSeed({ worldId: "ghost" })],
      })
    );
    await expect(loadContent()).rejects.toThrow(/unknown world/);
  });

  it("rejects when a mission references an unknown molecule", async () => {
    stubFetch(
      bundle({
        missions: [missionSeed({ allowedMolecules: ["unknown"] })],
      })
    );
    await expect(loadContent()).rejects.toThrow(/unknown molecule/);
  });

  it("getElementBySymbol returns undefined when missing", () => {
    expect(getElementBySymbol([elementSeed()], "Zz")).toBeUndefined();
  });

  it("getMoleculeById returns the matching molecule", () => {
    const m = moleculeSeed("water");
    expect(getMoleculeById([m], "water")).toBe(m);
    expect(getMoleculeById([m], "missing")).toBeUndefined();
  });

  it("getString falls back to the key when not found", () => {
    const strings: LocalizedString[] = [
      { stringKey: "hi", locale: "en", text: "Hello", voiceoverRef: null, readingLevelBand: "8-10" },
    ];
    expect(getString(strings, "hi")).toBe("Hello");
    expect(getString(strings, "missing")).toBe("missing");
  });
});
