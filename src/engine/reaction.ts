import type { Reaction, SceneAtom, SceneBond, Molecule } from "@/types";

export interface ReactionValidationResult {
  conserved: boolean;
  reactantCounts: Record<string, number>;
  productCounts: Record<string, number>;
  explanation: string;
}

export interface ReactionMissionValidationResult {
  success: boolean;
  conservation: ReactionValidationResult;
  productsValid: boolean;
  reactantsValid: boolean;
  explanation: string;
}

export function validateAtomConservation(
  reactants: SceneAtom[],
  products: SceneAtom[]
): ReactionValidationResult {
  const reactantCounts = countElements(reactants);
  const productCounts = countElements(products);

  const allElements = new Set([
    ...Object.keys(reactantCounts),
    ...Object.keys(productCounts),
  ]);

  let conserved = true;
  for (const element of allElements) {
    if (reactantCounts[element] !== productCounts[element]) {
      conserved = false;
      break;
    }
  }

  const explanation = conserved
    ? "Great! The number of each type of atom is the same on both sides. Atoms are conserved!"
    : "The atom counts do not match. Remember: atoms cannot be created or destroyed in a chemical reaction.";

  return {
    conserved,
    reactantCounts,
    productCounts,
    explanation,
  };
}

function countElements(atoms: SceneAtom[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const atom of atoms) {
    counts[atom.elementId] = (counts[atom.elementId] || 0) + 1;
  }
  return counts;
}

export function matchReactionToScene(
  reaction: Reaction,
  sceneAtoms: SceneAtom[],
  sceneBonds: SceneBond[]
): { matches: boolean; explanation: string } {
  const sceneCounts = countElements(sceneAtoms);

  for (const [element, count] of Object.entries(reaction.conservationSignature)) {
    if ((sceneCounts[element] || 0) < count) {
      return {
        matches: false,
        explanation: `You need more ${element} atoms. This reaction needs ${count} ${element} atoms total.`,
      };
    }
  }

  return {
    matches: true,
    explanation: "Your scene has the right atoms for this reaction!",
  };
}

/**
 * Validates a reaction mission scene.
 * Atoms left of centerX are reactants; atoms right of centerX are products.
 */
export function validateReactionMission(
  reaction: Reaction,
  molecules: Molecule[],
  sceneAtoms: SceneAtom[],
  sceneBonds: SceneBond[],
  centerX: number
): ReactionMissionValidationResult {
  // Partition atoms by position
  const reactantAtoms = sceneAtoms.filter((a) => a.x < centerX);
  const productAtoms = sceneAtoms.filter((a) => a.x >= centerX);

  // 1. Conservation check
  const conservation = validateAtomConservation(reactantAtoms, productAtoms);

  // 2. Validate product molecules
  const productBonds = sceneBonds.filter(
    (b) =>
      productAtoms.some((a) => a.id === b.atomAId) &&
      productAtoms.some((a) => a.id === b.atomBId)
  );
  const productsValid = validateSideMolecules(
    reaction.products,
    productAtoms,
    productBonds,
    molecules
  );

  // 3. Validate reactant molecules (soft requirement)
  const reactantBonds = sceneBonds.filter(
    (b) =>
      reactantAtoms.some((a) => a.id === b.atomAId) &&
      reactantAtoms.some((a) => a.id === b.atomBId)
  );
  const reactantsValid = validateSideMolecules(
    reaction.reactants,
    reactantAtoms,
    reactantBonds,
    molecules
  );

  // Build explanation
  let explanation = "";
  if (!conservation.conserved) {
    explanation = conservation.explanation;
  } else if (!productsValid) {
    explanation =
      "The atoms on the product side do not form the correct molecules. Check your bonds and atom counts on the right side.";
  } else if (!reactantsValid) {
    explanation =
      "Atoms are conserved, but the reactant molecules do not look right. Check the left side.";
  } else {
    explanation = `Excellent! You correctly showed ${reaction.equationDisplay}. Atoms are conserved!`;
  }

  return {
    success: conservation.conserved && productsValid,
    conservation,
    productsValid,
    reactantsValid,
    explanation,
  };
}

/**
 * Checks if atoms on one side of the reaction form the expected molecules
 * in the correct stoichiometric ratios.
 */
function validateSideMolecules(
  expected: { moleculeId: string; coefficient: number }[],
  atoms: SceneAtom[],
  bonds: SceneBond[],
  molecules: Molecule[]
): boolean {
  if (atoms.length === 0) return false;

  // Find connected components
  const components = findConnectedComponents(atoms, bonds);

  // Count matched molecules
  const foundCounts: Record<string, number> = {};

  for (const component of components) {
    const matchedId = matchComponentToMolecule(component, atoms, bonds, molecules);
    if (matchedId) {
      foundCounts[matchedId] = (foundCounts[matchedId] || 0) + 1;
    }
  }

  // Check against expected coefficients
  for (const exp of expected) {
    if ((foundCounts[exp.moleculeId] || 0) < exp.coefficient) {
      return false;
    }
  }

  // Also verify no unexpected extra atoms (tolerance: allow extra molecules of expected types)
  const totalExpectedAtoms = expected.reduce((sum, exp) => {
    const mol = molecules.find((m) => m.moleculeId === exp.moleculeId);
    return sum + (mol ? mol.allowedBondGraph.nodes.length * exp.coefficient : 0);
  }, 0);

  return atoms.length === totalExpectedAtoms;
}

/**
 * Find connected components in the atom/bond graph.
 * Returns arrays of atom IDs, one per component.
 */
function findConnectedComponents(
  atoms: SceneAtom[],
  bonds: SceneBond[]
): string[][] {
  const atomIds = new Set(atoms.map((a) => a.id));
  const adj = new Map<string, Set<string>>();

  for (const id of atomIds) {
    adj.set(id, new Set());
  }

  for (const b of bonds) {
    if (atomIds.has(b.atomAId) && atomIds.has(b.atomBId)) {
      adj.get(b.atomAId)?.add(b.atomBId);
      adj.get(b.atomBId)?.add(b.atomAId);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const id of atomIds) {
    if (visited.has(id)) continue;

    const component: string[] = [];
    const stack = [id];
    visited.add(id);

    while (stack.length > 0) {
      const curr = stack.pop()!;
      component.push(curr);
      for (const neighbor of adj.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Try to match a connected component of atoms to a known molecule.
 * Returns the matched moleculeId or null.
 */
function matchComponentToMolecule(
  componentAtomIds: string[],
  allAtoms: SceneAtom[],
  allBonds: SceneBond[],
  molecules: Molecule[]
): string | null {
  const componentAtoms = allAtoms.filter((a) => componentAtomIds.includes(a.id));
  const componentBonds = allBonds.filter(
    (b) => componentAtomIds.includes(b.atomAId) && componentAtomIds.includes(b.atomBId)
  );

  // Build scene graph
  const nodeMap = new Map<string, number>();
  componentAtoms.forEach((a, i) => nodeMap.set(a.id, i));

  const sceneGraph = {
    nodes: componentAtoms.map((a) => a.elementId),
    edges: componentBonds
      .map((b) => {
        const from = nodeMap.get(b.atomAId);
        const to = nodeMap.get(b.atomBId);
        if (from === undefined || to === undefined) return null;
        return { from, to };
      })
      .filter((e): e is { from: number; to: number } => e !== null),
  };

  // Try to match against all known molecules
  for (const molecule of molecules) {
    if (isGraphMatch(sceneGraph, molecule.allowedBondGraph)) {
      return molecule.moleculeId;
    }
  }

  return null;
}

/**
 * Simplified graph matching (node count, edge count, element counts, isomorphism).
 * Duplicated from molecule.ts to avoid circular dependency.
 */
function isGraphMatch(
  scene: { nodes: string[]; edges: { from: number; to: number }[] },
  target: { nodes: { elementId: string }[]; edges: { from: number; to: number }[] }
): boolean {
  if (scene.nodes.length !== target.nodes.length) return false;
  if (scene.edges.length !== target.edges.length) return false;

  const sceneCounts = new Map<string, number>();
  for (const el of scene.nodes) {
    sceneCounts.set(el, (sceneCounts.get(el) || 0) + 1);
  }

  const targetCounts = new Map<string, number>();
  for (const node of target.nodes) {
    targetCounts.set(node.elementId, (targetCounts.get(node.elementId) || 0) + 1);
  }

  for (const [el, count] of targetCounts) {
    if (sceneCounts.get(el) !== count) return false;
  }
  for (const [el, count] of sceneCounts) {
    if (targetCounts.get(el) !== count) return false;
  }

  return isIsomorphic(scene, target);
}

function isIsomorphic(
  scene: { nodes: string[]; edges: { from: number; to: number }[] },
  target: { nodes: { elementId: string }[]; edges: { from: number; to: number }[] }
): boolean {
  const n = scene.nodes.length;
  if (n === 0) return true;
  if (n !== target.nodes.length) return false;

  const indices = Array.from({ length: n }, (_, i) => i);
  for (const perm of permutations(indices)) {
    if (isValidPermutation(scene, target, perm)) {
      return true;
    }
  }
  return false;
}

function isValidPermutation(
  scene: { nodes: string[]; edges: { from: number; to: number }[] },
  target: { nodes: { elementId: string }[]; edges: { from: number; to: number }[] },
  perm: number[]
): boolean {
  for (let i = 0; i < perm.length; i++) {
    if (scene.nodes[perm[i]] !== target.nodes[i].elementId) {
      return false;
    }
  }

  const sceneEdgeSet = new Set<string>();
  for (const e of scene.edges) {
    const a = Math.min(perm.indexOf(e.from), perm.indexOf(e.to));
    const b = Math.max(perm.indexOf(e.from), perm.indexOf(e.to));
    sceneEdgeSet.add(`${a}-${b}`);
  }

  const targetEdgeSet = new Set<string>();
  for (const e of target.edges) {
    const a = Math.min(e.from, e.to);
    const b = Math.max(e.from, e.to);
    targetEdgeSet.add(`${a}-${b}`);
  }

  if (sceneEdgeSet.size !== targetEdgeSet.size) return false;
  for (const edge of sceneEdgeSet) {
    if (!targetEdgeSet.has(edge)) return false;
  }

  return true;
}

function* permutations(arr: number[]): Generator<number[]> {
  if (arr.length <= 6) {
    yield* heapPermutation(arr, arr.length);
  }
}

function* heapPermutation(arr: number[], size: number): Generator<number[]> {
  if (size === 1) {
    yield [...arr];
    return;
  }
  for (let i = 0; i < size; i++) {
    yield* heapPermutation(arr, size - 1);
    if (size % 2 === 1) {
      [arr[0], arr[size - 1]] = [arr[size - 1], arr[0]];
    } else {
      [arr[i], arr[size - 1]] = [arr[size - 1], arr[i]];
    }
  }
}
