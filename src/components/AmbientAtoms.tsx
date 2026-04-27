"use client";

import { useMemo, useEffect, useState } from "react";

// Ambient atmosphere layer for the home screen and the world map.
// Renders a small constellation of soft, faintly-tinted "atoms"
// drifting slowly in place — adds chemistry-flavored personality to
// otherwise schematic surfaces without competing with the actual UI.
//
// All animation is GPU-only (opacity + transform) and capped at a
// gentle ±60–80px drift over 30+ seconds, so visual cost is near-zero
// and motion stays well under the threshold that would distract.
// Honors prefers-reduced-motion: layout stays the same but atoms
// freeze at their start position.
//
// The parent of this component must be `position: relative` (or
// otherwise establish a stacking context) and ideally have
// `overflow: hidden` so atoms don't bleed past page boundaries.

const ATOM_COLORS = [
  "#ef4444", // oxygen-red
  "#3b82f6", // hydrogen-blue
  "#475569", // carbon-slate
  "#f59e0b", // transition-amber
  "#84cc16", // post-transition-lime
  "#06b6d4", // noble-gas-cyan
  "#8b5cf6", // halogen-violet
  "#15803d", // brand-green
];

interface FloatAtom {
  id: number;
  leftPct: number;
  topPct: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  durationMs: number;
  delayMs: number;
}

// Tiny seeded PRNG so the layout is stable across renders / SSR
// hydration. A purely-random shuffle would mismatch on hydration and
// flash. Park-Miller-ish; not crypto, just predictable.
function makeAtoms(count: number, seed: number): FloatAtom[] {
  let s = seed;
  const next = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const atoms: FloatAtom[] = [];
  for (let i = 0; i < count; i++) {
    atoms.push({
      id: i,
      leftPct: next() * 100,
      topPct: next() * 100,
      dx: (next() - 0.5) * 80,
      dy: (next() - 0.5) * 80,
      size: 26 + next() * 30,
      color: ATOM_COLORS[Math.floor(next() * ATOM_COLORS.length)],
      durationMs: 28000 + next() * 22000,
      // Negative delays so atoms are already mid-drift on mount
      // rather than all easing out of their start positions in sync.
      delayMs: -next() * 30000,
    });
  }
  return atoms;
}

interface AmbientAtomsProps {
  count?: number;
  // Distinct seeds let LabHub and WorldMap have visually different
  // background distributions while staying deterministic per surface.
  seed?: number;
}

export default function AmbientAtoms({ count = 12, seed = 42 }: AmbientAtomsProps) {
  const atoms = useMemo(() => makeAtoms(count, seed), [count, seed]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {atoms.map((a) => (
        <div
          key={a.id}
          className={
            reduceMotion ? "ambient-atom" : "ambient-atom ambient-atom-drift"
          }
          style={
            {
              left: `${a.leftPct}%`,
              top: `${a.topPct}%`,
              width: `${a.size}px`,
              height: `${a.size}px`,
              background: `radial-gradient(circle at 35% 30%, ${a.color}55, ${a.color}22 60%, transparent 80%)`,
              animationDuration: `${a.durationMs}ms`,
              animationDelay: `${a.delayMs}ms`,
              "--drift-x": `${a.dx}px`,
              "--drift-y": `${a.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
