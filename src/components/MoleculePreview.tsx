"use client";

import { useId } from "react";
import type { Element, Molecule } from "@/types";

interface MoleculePreviewProps {
  molecule: Molecule;
  elements: Element[];
  // Side length of the rendered SVG in CSS pixels. The viewBox is a
  // fixed 100×100 unit grid so atoms / bonds keep relative proportions
  // at any pixel size.
  size?: number;
}

// Static 2D Lewis-style preview of a molecule. Used in the game HUD
// (and any "what should I build?" surface) so kids can see the target
// structure instead of having to parse the brief text.
//
// Layout strategy: detect the molecule shape (single atom, diatomic,
// star around one center, or chain) and lay nodes out accordingly.
// Force-directed layout is overkill for the curriculum molecules,
// which all fall into one of these four shapes.
//
// Bond rendering mirrors the canvas: each covalent bond is layered
// (shadow → outline → element-color gradient), so the preview reads
// as a polished diagram rather than a flat schematic.
export default function MoleculePreview({
  molecule,
  elements,
  size = 36,
}: MoleculePreviewProps) {
  const graph = molecule.allowedBondGraph;
  const positions = layoutMolecule(graph);
  const atomR = atomRadiusFor(graph.nodes.length);
  // Stable id prefix for gradient defs so multiple previews on the
  // page don't collide on the same `bond-0` URL fragment.
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label={`${molecule.displayName} structure`}
    >
      <defs>
        {graph.edges.map((edge, i) => {
          const fromElem = elements.find(
            (e) => e.symbol === graph.nodes[edge.from].elementId
          );
          const toElem = elements.find(
            (e) => e.symbol === graph.nodes[edge.to].elementId
          );
          const colorA = fromElem?.colorToken ?? "#475569";
          const colorB = toElem?.colorToken ?? "#475569";
          const a = positions[edge.from];
          const b = positions[edge.to];
          return (
            <linearGradient
              key={`g-${i}`}
              id={`${gradientId}-bond-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            >
              <stop offset="0%" stopColor={colorA} />
              <stop offset="100%" stopColor={colorB} />
            </linearGradient>
          );
        })}
      </defs>

      {/* Bonds first so atoms cover the line ends — no need to
          stop-short the strokes. */}
      {graph.edges.map((edge, i) => (
        <BondLine
          key={`b-${i}`}
          from={positions[edge.from]}
          to={positions[edge.to]}
          type={edge.type}
          gradientUrl={`url(#${gradientId}-bond-${i})`}
        />
      ))}
      {graph.nodes.map((node, i) => {
        const elem = elements.find((e) => e.symbol === node.elementId);
        const fill = elem?.colorToken ?? "#94a3b8";
        const pos = positions[i];
        return (
          <g key={`a-${i}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={atomR}
              fill={fill}
              stroke="#0f172a"
              strokeWidth={0.6}
            />
            <text
              x={pos.x}
              y={pos.y}
              fontSize={atomR * 1.05}
              fontWeight={700}
              fill="white"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {node.elementId}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function atomRadiusFor(nodeCount: number): number {
  // Tighten atoms as the molecule grows so they all fit the 100×100
  // viewBox without overlapping.
  if (nodeCount <= 2) return 14;
  if (nodeCount <= 3) return 12;
  if (nodeCount <= 5) return 10;
  return 8;
}

// Bond palette — kept in sync with bond-graphics.ts so the HUD
// preview reads as the same visual language as the canvas.
const BOND_SHADOW = "#cbd5e1"; // slate-300
const BOND_OUTLINE = "#0f172a"; // slate-900
const IONIC_COLOR = "#7c3aed"; // violet-600

function BondLine({
  from,
  to,
  type,
  gradientUrl,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type: string;
  gradientUrl: string;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular unit vector for offsetting parallel strokes.
  const px = -uy;
  const py = ux;

  if (type === "ionic") {
    // Ionic gets its own treatment — violet dashed inner over a
    // slate outline so it stays visually distinct from covalent.
    return (
      <g>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={BOND_OUTLINE}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="3 1.6"
          opacity={0.85}
        />
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={IONIC_COLOR}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeDasharray="3 1.6"
        />
      </g>
    );
  }

  if (type === "covalent-double") {
    const off = 1.8;
    return (
      <g>
        <LayeredCovalent
          from={{ x: from.x + px * off, y: from.y + py * off }}
          to={{ x: to.x + px * off, y: to.y + py * off }}
          gradientUrl={gradientUrl}
          inner={1.2}
          outline={2.2}
          shadow={3.4}
        />
        <LayeredCovalent
          from={{ x: from.x - px * off, y: from.y - py * off }}
          to={{ x: to.x - px * off, y: to.y - py * off }}
          gradientUrl={gradientUrl}
          inner={1.2}
          outline={2.2}
          shadow={3.4}
        />
      </g>
    );
  }

  if (type === "covalent-triple") {
    const off = 2.4;
    return (
      <g>
        <LayeredCovalent
          from={{ x: from.x + px * off, y: from.y + py * off }}
          to={{ x: to.x + px * off, y: to.y + py * off }}
          gradientUrl={gradientUrl}
          inner={1.1}
          outline={2.0}
          shadow={3.0}
        />
        <LayeredCovalent
          from={from}
          to={to}
          gradientUrl={gradientUrl}
          inner={1.1}
          outline={2.0}
          shadow={3.0}
        />
        <LayeredCovalent
          from={{ x: from.x - px * off, y: from.y - py * off }}
          to={{ x: to.x - px * off, y: to.y - py * off }}
          gradientUrl={gradientUrl}
          inner={1.1}
          outline={2.0}
          shadow={3.0}
        />
      </g>
    );
  }

  return (
    <LayeredCovalent
      from={from}
      to={to}
      gradientUrl={gradientUrl}
      inner={1.7}
      outline={2.8}
      shadow={4.2}
    />
  );
}

// One covalent stroke as three stacked lines: a soft slate shadow,
// a thin dark outline, and an element-gradient inner — same recipe
// the canvas uses in bond-graphics.ts.
function LayeredCovalent({
  from,
  to,
  gradientUrl,
  inner,
  outline,
  shadow,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  gradientUrl: string;
  inner: number;
  outline: number;
  shadow: number;
}) {
  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={BOND_SHADOW}
        strokeWidth={shadow}
        strokeLinecap="round"
        opacity={0.55}
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={BOND_OUTLINE}
        strokeWidth={outline}
        strokeLinecap="round"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={gradientUrl}
        strokeWidth={inner}
        strokeLinecap="round"
      />
    </g>
  );
}

// Position nodes in the 100×100 viewBox. Picks a layout based on the
// structure of the bond graph rather than running a generic force
// solver — every molecule in the SparkLab curriculum falls into one
// of these four shapes.
function layoutMolecule(graph: {
  nodes: { elementId: string }[];
  edges: { from: number; to: number }[];
}): Array<{ x: number; y: number }> {
  const n = graph.nodes.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 50, y: 50 }];
  if (n === 2) return [{ x: 22, y: 50 }, { x: 78, y: 50 }];

  // Build adjacency for shape detection.
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of graph.edges) {
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
  }

  // Star detection: one node connected to all others (e.g. CH₄, NH₃,
  // H₂O — central atom with leaves around it).
  let centerIdx = 0;
  for (let i = 1; i < n; i++) {
    if (adj[i].length > adj[centerIdx].length) centerIdx = i;
  }
  if (adj[centerIdx].length === n - 1) {
    const positions: Array<{ x: number; y: number }> = new Array(n);
    positions[centerIdx] = { x: 50, y: 50 };
    const leaves = adj[centerIdx];
    // Special-case 2-leaf stars (H₂O, CO₂) — render with the leaves
    // at left/right rather than top/bottom so the molecule reads
    // left-to-right like a textbook diagram.
    if (leaves.length === 2) {
      positions[leaves[0]] = { x: 22, y: 50 };
      positions[leaves[1]] = { x: 78, y: 50 };
      return positions;
    }
    const radius = leaves.length >= 4 ? 32 : 30;
    for (let i = 0; i < leaves.length; i++) {
      // Start at -π/2 so the first leaf sits straight up — the
      // molecule reads with its "top" leaf at the top of the box.
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / leaves.length;
      positions[leaves[i]] = {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
      };
    }
    return positions;
  }

  // Chain layout: BFS from a degree-1 endpoint and lay nodes out
  // horizontally in order. Covers H₂O₂ (H-O-O-H) and similar.
  let startIdx = 0;
  for (let i = 0; i < n; i++) {
    if (adj[i].length === 1) {
      startIdx = i;
      break;
    }
  }
  const order: number[] = [];
  const visited = new Set<number>([startIdx]);
  const queue = [startIdx];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    order.push(curr);
    for (const next of adj[curr]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const positions: Array<{ x: number; y: number }> = new Array(n);
  const span = 76;
  const start = (100 - span) / 2;
  for (let i = 0; i < order.length; i++) {
    const t = order.length === 1 ? 0.5 : i / (order.length - 1);
    positions[order[i]] = { x: start + t * span, y: 50 };
  }
  return positions;
}
