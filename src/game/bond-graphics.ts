import { Graphics } from "pixi.js";
import { ATOM_RADIUS } from "./atom-sprite";

// Bond palette — chosen to feel less "engineering schematic" and more
// "polished diagram." Single bonds get a layered tube treatment
// (drop-shadow → outline → gradient inner) for depth; multi-bond
// strokes use rounded caps for friendliness without going chunky.
//
// The inner stroke is a per-segment gradient between the two atoms'
// element colors so each bond inherits visual identity from its
// endpoints — an H-O bond reads as blue→red, an N-N bond is solid
// blue, etc. Ionic stays a single violet color because it's a
// *different kind* of bond (electron transfer, not sharing) and the
// chemistry feels clearer when it doesn't blend like a covalent.
const BOND_OUTLINE = 0x0f172a;     // slate-900 — thin dark border for definition
const BOND_SHADOW = 0xcbd5e1;      // slate-300 — soft drop shadow underneath
const BOND_INNER_FALLBACK = 0x475569; // slate-600 — when no element color is supplied
const IONIC_COLOR = 0x7c3aed;      // violet-600 — readably different from covalent
const SELECTED_COLOR = 0x15803d;   // brand green-700 — matches Phase 2 primary

// How many segments to draw the gradient stroke in. 18 is invisible at
// typical zoom levels (sub-pixel steps for normal bond lengths) while
// staying cheap in stroke-call count.
const GRADIENT_SEGMENTS = 18;

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gr = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gr << 8) | bl;
}

/** Draw a single line segment with a per-piece gradient interpolating
 *  between two atom colors. */
function strokeGradientLine(
  g: Graphics,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  colorA: number,
  colorB: number,
  width: number
) {
  for (let i = 0; i < GRADIENT_SEGMENTS; i++) {
    const t1 = i / GRADIENT_SEGMENTS;
    const t2 = (i + 1) / GRADIENT_SEGMENTS;
    const tMid = (t1 + t2) / 2;
    const color = lerpColor(colorA, colorB, tMid);
    g.moveTo(sx + (ex - sx) * t1, sy + (ey - sy) * t1);
    g.lineTo(sx + (ex - sx) * t2, sy + (ey - sy) * t2);
    g.stroke({ color, width, cap: "round" });
  }
}

/**
 * Draw a bond between two atoms in scene-local coordinates.
 * Also (re)applies a forgiving hit area along the bond line so thin strokes
 * are still easy to click. `isSelected` toggles a translucent halo underlay.
 *
 * `colorA` / `colorB` are the element colors of the two endpoints. The
 * inner stroke gradients between them so each bond inherits visual
 * identity from its atoms. Optional — falls back to a neutral slate
 * if either is missing.
 */
export function drawBond(
  g: Graphics,
  atomA: { x: number; y: number },
  atomB: { x: number; y: number },
  bondType: string,
  isSelected = false,
  colorA?: number,
  colorB?: number
) {
  g.clear();

  const dx = atomB.x - atomA.x;
  const dy = atomB.y - atomA.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) {
    g.hitArea = null;
    return;
  }

  // Forgiving click target along the bond line (in scene-local coords).
  const ax = atomA.x;
  const ay = atomA.y;
  const bx = atomB.x;
  const by = atomB.y;
  g.hitArea = {
    contains(px: number, py: number) {
      const vx = bx - ax;
      const vy = by - ay;
      const lenSq = vx * vx + vy * vy;
      if (lenSq === 0) return false;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
      const cx = ax + t * vx;
      const cy = ay + t * vy;
      const ddx = px - cx;
      const ddy = py - cy;
      return ddx * ddx + ddy * ddy <= 14 * 14;
    },
  };

  const nx = dx / dist;
  const ny = dy / dist;
  const offset = ATOM_RADIUS;

  const startX = atomA.x + nx * offset;
  const startY = atomA.y + ny * offset;
  const endX = atomB.x - nx * offset;
  const endY = atomB.y - ny * offset;

  if (isSelected) {
    g.moveTo(startX, startY);
    g.lineTo(endX, endY);
    g.stroke({ color: SELECTED_COLOR, width: 12, alpha: 0.4, cap: "round" });
  }

  const innerA = colorA ?? BOND_INNER_FALLBACK;
  const innerB = colorB ?? BOND_INNER_FALLBACK;

  if (bondType === "ionic") {
    drawIonic(g, startX, startY, endX, endY);
  } else if (bondType === "covalent-double") {
    drawDouble(g, startX, startY, endX, endY, nx, ny, innerA, innerB);
  } else if (bondType === "covalent-triple") {
    drawTriple(g, startX, startY, endX, endY, nx, ny, innerA, innerB);
  } else {
    drawSingle(g, startX, startY, endX, endY, innerA, innerB);
  }
}

/** Single covalent — drop shadow → outline → element-color gradient
 *  inner. The gradient is the visual upgrade vs. flat slate. */
function drawSingle(
  g: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  colorA: number,
  colorB: number
) {
  // Drop shadow: a soft, slightly thicker pad behind the bond.
  g.moveTo(startX, startY);
  g.lineTo(endX, endY);
  g.stroke({ color: BOND_SHADOW, width: 9, alpha: 0.45, cap: "round" });

  // Outline: thin dark border around the inner stroke.
  g.moveTo(startX, startY);
  g.lineTo(endX, endY);
  g.stroke({ color: BOND_OUTLINE, width: 6, alpha: 1, cap: "round" });

  // Inner: gradient between the two atoms' element colors.
  strokeGradientLine(g, startX, startY, endX, endY, colorA, colorB, 4);
}

/** Double covalent — two parallel outline-and-gradient pairs; no drop
 *  shadow because the dual lines already read as denser than a single. */
function drawDouble(
  g: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  nx: number,
  ny: number,
  colorA: number,
  colorB: number
) {
  const perpX = -ny * 5;
  const perpY = nx * 5;

  // Outer outlines for both lines.
  g.moveTo(startX + perpX, startY + perpY);
  g.lineTo(endX + perpX, endY + perpY);
  g.moveTo(startX - perpX, startY - perpY);
  g.lineTo(endX - perpX, endY - perpY);
  g.stroke({ color: BOND_OUTLINE, width: 5, alpha: 1, cap: "round" });

  // Inner colored bodies — gradient on each parallel line.
  strokeGradientLine(
    g,
    startX + perpX,
    startY + perpY,
    endX + perpX,
    endY + perpY,
    colorA,
    colorB,
    3
  );
  strokeGradientLine(
    g,
    startX - perpX,
    startY - perpY,
    endX - perpX,
    endY - perpY,
    colorA,
    colorB,
    3
  );
}

/** Triple covalent — three parallel outline-and-gradient pairs. */
function drawTriple(
  g: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  nx: number,
  ny: number,
  colorA: number,
  colorB: number
) {
  const perpX = -ny * 7;
  const perpY = nx * 7;

  // Outer outlines for the three lines.
  g.moveTo(startX + perpX, startY + perpY);
  g.lineTo(endX + perpX, endY + perpY);
  g.moveTo(startX, startY);
  g.lineTo(endX, endY);
  g.moveTo(startX - perpX, startY - perpY);
  g.lineTo(endX - perpX, endY - perpY);
  g.stroke({ color: BOND_OUTLINE, width: 5, alpha: 1, cap: "round" });

  // Inner colored bodies — gradient on each of the three lines.
  strokeGradientLine(
    g,
    startX + perpX,
    startY + perpY,
    endX + perpX,
    endY + perpY,
    colorA,
    colorB,
    3
  );
  strokeGradientLine(g, startX, startY, endX, endY, colorA, colorB, 3);
  strokeGradientLine(
    g,
    startX - perpX,
    startY - perpY,
    endX - perpX,
    endY - perpY,
    colorA,
    colorB,
    3
  );
}

/** Ionic — dashed line in violet so it reads as a different *kind* of
 *  bond, not just a thinner covalent. Rounded dash caps for friendliness. */
function drawIonic(
  g: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const dashLen = 10;
  const gapLen = 6;
  const dxTotal = endX - startX;
  const dyTotal = endY - startY;
  const totalLen = Math.sqrt(dxTotal * dxTotal + dyTotal * dyTotal);
  if (totalLen === 0) return;

  // Two-pass draw so each dash gets a tiny outline behind it. Both
  // strokes share the same path for performance — Pixi v8 records the
  // path once and the second `stroke()` re-uses it.
  let traveled = 0;
  while (traveled < totalLen) {
    const t1 = traveled / totalLen;
    const t2 = Math.min(1, (traveled + dashLen) / totalLen);
    g.moveTo(startX + dxTotal * t1, startY + dyTotal * t1);
    g.lineTo(startX + dxTotal * t2, startY + dyTotal * t2);
    traveled += dashLen + gapLen;
  }
  // Outline pass.
  g.stroke({ color: BOND_OUTLINE, width: 5, alpha: 1, cap: "round" });

  // Re-trace the dashes for the inner color.
  traveled = 0;
  while (traveled < totalLen) {
    const t1 = traveled / totalLen;
    const t2 = Math.min(1, (traveled + dashLen) / totalLen);
    g.moveTo(startX + dxTotal * t1, startY + dyTotal * t1);
    g.lineTo(startX + dxTotal * t2, startY + dyTotal * t2);
    traveled += dashLen + gapLen;
  }
  g.stroke({ color: IONIC_COLOR, width: 3.5, alpha: 1, cap: "round" });
}
