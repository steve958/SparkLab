import type { Molecule, SceneAtom, SceneBond, BondGraph } from "@/types";
import { getMoleculeById } from "@/data/loader";

export interface MoleculeValidationResult {
  matches: boolean;
  matchedMoleculeId: string | null;
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
