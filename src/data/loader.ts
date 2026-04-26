import type {
  Element,
  BondRule,
  Molecule,
  Reaction,
  Mission,
  World,
  LocalizedString,
  BadgeDefinition,
  WorldMasteryCheck,
} from "@/types";

export interface ContentBundle {
  elements: Element[];
  bondRules: BondRule[];
  molecules: Molecule[];
  reactions: Reaction[];
  missions: Mission[];
  worlds: World[];
  strings: LocalizedString[];
  badges: BadgeDefinition[];
  masteryChecks: WorldMasteryCheck[];
}

let cache: ContentBundle | null = null;

export async function loadContent(): Promise<ContentBundle> {
  if (cache) return cache;

  const [
    elements,
    bondRules,
    molecules,
    reactions,
    missions,
    worlds,
    strings,
    badges,
    masteryChecks,
  ] = await Promise.all([
    fetch("/data/elements.json").then((r) => r.json() as Promise<Element[]>),
    fetch("/data/bond_rules.json").then(
      (r) => r.json() as Promise<BondRule[]>
    ),
    fetch("/data/molecules.json").then(
      (r) => r.json() as Promise<Molecule[]>
    ),
    fetch("/data/reactions.json").then(
      (r) => r.json() as Promise<Reaction[]>
    ),
    fetch("/data/missions.json").then((r) => r.json() as Promise<Mission[]>),
    fetch("/data/worlds.json").then((r) => r.json() as Promise<World[]>),
    fetch("/data/strings.json").then(
      (r) => r.json() as Promise<LocalizedString[]>
    ),
    fetch("/data/badges.json").then(
      (r) => r.json() as Promise<BadgeDefinition[]>
    ),
    fetch("/data/mastery_checks.json").then(
      (r) => r.json() as Promise<WorldMasteryCheck[]>
    ),
  ]);

  const bundle: ContentBundle = {
    elements,
    bondRules,
    molecules,
    reactions,
    missions,
    worlds,
    strings,
    badges,
    masteryChecks,
  };

  validateBundle(bundle);
  cache = bundle;
  return bundle;
}

export function getCachedContent(): ContentBundle | null {
  return cache;
}

export function clearContentCache(): void {
  cache = null;
}

function validateBundle(bundle: ContentBundle): void {
  const errors: string[] = [];

  // Validate element symbols are unique
  const elementSymbols = new Set<string>();
  for (const el of bundle.elements) {
    if (elementSymbols.has(el.symbol)) {
      errors.push(`Duplicate element symbol: ${el.symbol}`);
    }
    elementSymbols.add(el.symbol);
  }

  // Validate molecule IDs are unique
  const moleculeIds = new Set<string>();
  for (const mol of bundle.molecules) {
    if (moleculeIds.has(mol.moleculeId)) {
      errors.push(`Duplicate molecule ID: ${mol.moleculeId}`);
    }
    moleculeIds.add(mol.moleculeId);
  }

  // Validate bond rules reference valid elements
  for (const rule of bundle.bondRules) {
    if (!elementSymbols.has(rule.atomA)) {
      errors.push(`Bond rule ${rule.ruleId} references unknown element ${rule.atomA}`);
    }
    if (!elementSymbols.has(rule.atomB)) {
      errors.push(`Bond rule ${rule.ruleId} references unknown element ${rule.atomB}`);
    }
  }

  // Validate missions reference valid worlds and molecules
  const worldIds = new Set(bundle.worlds.map((w) => w.worldId));
  for (const mission of bundle.missions) {
    if (!worldIds.has(mission.worldId)) {
      errors.push(`Mission ${mission.missionId} references unknown world ${mission.worldId}`);
    }
    for (const molId of mission.allowedMolecules) {
      if (!moleculeIds.has(molId)) {
        errors.push(`Mission ${mission.missionId} references unknown molecule ${molId}`);
      }
    }
  }

  // Validate reaction molecule references
  for (const reaction of bundle.reactions) {
    for (const rp of [...reaction.reactants, ...reaction.products]) {
      if (!moleculeIds.has(rp.moleculeId)) {
        errors.push(`Reaction ${reaction.reactionId} references unknown molecule ${rp.moleculeId}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Content validation failed:\n${errors.join("\n")}`);
  }
}

export function getString(
  strings: LocalizedString[],
  key: string,
  locale = "en"
): string {
  const match = strings.find((s) => s.stringKey === key && s.locale === locale);
  return match?.text ?? key;
}

export function getElementBySymbol(
  elements: Element[],
  symbol: string
): Element | undefined {
  return elements.find((e) => e.symbol === symbol);
}

export function getMoleculeById(
  molecules: Molecule[],
  id: string
): Molecule | undefined {
  return molecules.find((m) => m.moleculeId === id);
}

export function getMissionById(
  missions: Mission[],
  id: string
): Mission | undefined {
  return missions.find((m) => m.missionId === id);
}

export function getWorldById(worlds: World[], id: string): World | undefined {
  return worlds.find((w) => w.worldId === id);
}

export function getBondRulesForPair(
  rules: BondRule[],
  a: string,
  b: string,
  ageBand?: string
): BondRule[] {
  return rules.filter((r) => {
    const matchPair =
      (r.atomA === a && r.atomB === b) || (r.atomA === b && r.atomB === a);
    const matchAge = ageBand ? r.ageBand === ageBand : true;
    return matchPair && matchAge;
  });
}
