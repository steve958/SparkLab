import type { Molecule, SceneAtom, SceneBond, BondGraph } from "@/types";
import { getMoleculeById } from "@/data/loader";

export interface MoleculeValidationResult {
  matches: boolean;
  matchedMoleculeId: string | null;
  explanation: string;
}

export interface MultiMoleculeValidationResult {
  matches: boolean;
  // moleculeId for each connected component that matched a known molecule,
  // in the order the components were discovered.
  matchedMoleculeIds: string[];
  // Required molecule IDs that aren't yet present in the scene (with
  // multiplicity — if the mission needs 2 H₂O and only 1 is built,
  // this lists "water" once).
  missingMoleculeIds: string[];
  // Number of connected components that didn't match any known molecule
  // — leftover atoms / partial structures the player still has to either
  // finish or remove.
  unmatchedComponents: number;
  explanation: string;
}

export function validateSceneMolecule(
  molecules: Molecule[],
  atoms: SceneAtom[],
  bonds: SceneBond[]
): MoleculeValidationResult {
  if (atoms.length === 0) {
    return { matches: false, matchedMoleculeId: null, explanation: "No atoms in the scene." };
  }

  // Build adjacency list from scene
  const sceneGraph = buildSceneGraph(atoms, bonds);

  // Try to match against all known molecules
  for (const molecule of molecules) {
    if (isGraphMatch(sceneGraph, molecule.allowedBondGraph)) {
      return {
        matches: true,
        matchedMoleculeId: molecule.moleculeId,
        explanation: `You built ${molecule.displayName}!`,
      };
    }
  }

  // Check if atoms are connected
  if (!isConnected(sceneGraph)) {
    return {
      matches: false,
      matchedMoleculeId: null,
      explanation: "Your atoms are not all connected. Try linking them with bonds.",
    };
  }

  return {
    matches: false,
    matchedMoleculeId: null,
    explanation: "This structure does not match a known molecule. Check your bonds and atom counts.",
  };
}

/**
 * Validates a scene against multiple required molecules — used by
 * missions whose successConditions list more than one build-molecule
 * target (e.g. "Ionic vs Covalent": water + sodium chloride).
 *
 * Splits the scene into connected components, matches each component
 * against the known molecule list, then checks that every required
 * molecule is present as a matched component (with multiplicity). A
 * disconnected scene is *expected* here — water and NaCl don't share
 * bonds — so we don't flag the lack of full connectivity as an error.
 */
export function validateSceneMolecules(
  knownMolecules: Molecule[],
  requiredMoleculeIds: string[],
  atoms: SceneAtom[],
  bonds: SceneBond[]
): MultiMoleculeValidationResult {
  if (atoms.length === 0) {
    return {
      matches: false,
      matchedMoleculeIds: [],
      missingMoleculeIds: [...requiredMoleculeIds],
      unmatchedComponents: 0,
      explanation:
        "No atoms in the scene yet. Build the molecules listed in the mission.",
    };
  }

  const components = findConnectedComponents(atoms, bonds);
  const matched: string[] = [];
  let unmatched = 0;
  for (const componentAtomIds of components) {
    const matchedId = matchComponentToMolecule(
      componentAtomIds,
      atoms,
      bonds,
      knownMolecules
    );
    if (matchedId) matched.push(matchedId);
    else unmatched += 1;
  }

  // Required vs matched, by multiplicity. A mission needing two waters
  // isn't satisfied by a single water + a NaCl — it has to see "water"
  // appear twice in the matched list.
  const matchedCounts = new Map<string, number>();
  for (const id of matched) {
    matchedCounts.set(id, (matchedCounts.get(id) ?? 0) + 1);
  }
  const requiredCounts = new Map<string, number>();
  for (const id of requiredMoleculeIds) {
    requiredCounts.set(id, (requiredCounts.get(id) ?? 0) + 1);
  }
  const missing: string[] = [];
  for (const [id, needed] of requiredCounts) {
    const have = matchedCounts.get(id) ?? 0;
    for (let i = have; i < needed; i++) missing.push(id);
  }

  let explanation: string;
  if (missing.length > 0) {
    const names = missing.map(
      (id) =>
        knownMolecules.find((m) => m.moleculeId === id)?.displayName ?? id
    );
    explanation = `Still need: ${names.join(", ")}.`;
  } else if (unmatched > 0) {
    // All required molecules are present but the player has extra
    // partial structures. We accept this as long as the requirements
    // are met — the message is informational, not blocking.
    explanation =
      "Looks like you also have some leftover atoms. The required molecules are built — you can clean up the extras or keep going.";
  } else {
    explanation = "You built every required molecule!";
  }

  return {
    // Soft-pass even with unmatched leftovers: as long as every
    // required molecule is present, the mission objective is met.
    // Partial / extra structures are a UX nudge, not a fail.
    matches: missing.length === 0,
    matchedMoleculeIds: matched,
    missingMoleculeIds: missing,
    unmatchedComponents: unmatched,
    explanation,
  };
}

function findConnectedComponents(
  atoms: SceneAtom[],
  bonds: SceneBond[]
): string[][] {
  const atomIds = new Set(atoms.map((a) => a.id));
  const adj = new Map<string, Set<string>>();
  for (const id of atomIds) adj.set(id, new Set());
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
      for (const neighbor of adj.get(curr) ?? []) {
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

function matchComponentToMolecule(
  componentAtomIds: string[],
  allAtoms: SceneAtom[],
  allBonds: SceneBond[],
  knownMolecules: Molecule[]
): string | null {
  const idSet = new Set(componentAtomIds);
  const componentAtoms = allAtoms.filter((a) => idSet.has(a.id));
  const componentBonds = allBonds.filter(
    (b) => idSet.has(b.atomAId) && idSet.has(b.atomBId)
  );
  const sceneGraph = buildSceneGraph(componentAtoms, componentBonds);
  for (const molecule of knownMolecules) {
    if (isGraphMatch(sceneGraph, molecule.allowedBondGraph)) {
      return molecule.moleculeId;
    }
  }
  return null;
}

function buildSceneGraph(
  atoms: SceneAtom[],
  bonds: SceneBond[]
): { nodes: string[]; edges: { from: number; to: number }[] } {
  const nodeMap = new Map<string, number>();
  atoms.forEach((a, i) => nodeMap.set(a.id, i));

  return {
    nodes: atoms.map((a) => a.elementId),
    edges: bonds
      .map((b) => {
        const from = nodeMap.get(b.atomAId);
        const to = nodeMap.get(b.atomBId);
        if (from === undefined || to === undefined) return null;
        return { from, to };
      })
      .filter((e): e is { from: number; to: number } => e !== null),
  };
}

function isConnected(graph: {
  nodes: string[];
  edges: { from: number; to: number }[];
}): boolean {
  if (graph.nodes.length === 0) return false;
  if (graph.nodes.length === 1) return true;

  const adj = new Map<number, Set<number>>();
  for (let i = 0; i < graph.nodes.length; i++) {
    adj.set(i, new Set());
  }
  for (const e of graph.edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  const visited = new Set<number>();
  const queue = [0];
  visited.add(0);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const neighbor of adj.get(curr) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === graph.nodes.length;
}

function isGraphMatch(
  scene: { nodes: string[]; edges: { from: number; to: number }[] },
  target: BondGraph
): boolean {
  // Quick reject: different node count
  if (scene.nodes.length !== target.nodes.length) return false;

  // Quick reject: different edge count
  if (scene.edges.length !== target.edges.length) return false;

  // Count elements in scene
  const sceneElementCounts = new Map<string, number>();
  for (const el of scene.nodes) {
    sceneElementCounts.set(el, (sceneElementCounts.get(el) || 0) + 1);
  }

  // Count elements in target
  const targetElementCounts = new Map<string, number>();
  for (const node of target.nodes) {
    targetElementCounts.set(
      node.elementId,
      (targetElementCounts.get(node.elementId) || 0) + 1
    );
  }

  // Compare element counts
  for (const [el, count] of targetElementCounts) {
    if (sceneElementCounts.get(el) !== count) return false;
  }
  for (const [el, count] of sceneElementCounts) {
    if (targetElementCounts.get(el) !== count) return false;
  }

  // Check if graphs are isomorphic (simplified: brute force for small molecules)
  return isIsomorphic(scene, target);
}

function isIsomorphic(
  scene: { nodes: string[]; edges: { from: number; to: number }[] },
  target: BondGraph
): boolean {
  const n = scene.nodes.length;
  if (n === 0) return true;
  if (n !== target.nodes.length) return false;

  // Generate all permutations for small graphs (n <= 6 for MVP)
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
  target: BondGraph,
  perm: number[]
): boolean {
  // Check node labels match
  for (let i = 0; i < perm.length; i++) {
    if (scene.nodes[perm[i]] !== target.nodes[i].elementId) {
      return false;
    }
  }

  // Build edge sets
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

function* heapPermutation(
  arr: number[],
  size: number
): Generator<number[]> {
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
