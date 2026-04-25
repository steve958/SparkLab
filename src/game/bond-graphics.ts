import { Graphics } from "pixi.js";
import { ATOM_RADIUS } from "./atom-sprite";

/**
 * Draw a bond between two atoms in scene-local coordinates.
 * Also (re)applies a forgiving hit area along the bond line so thin strokes
 * are still easy to click. `isSelected` toggles a translucent halo underlay.
 */
export function drawBond(
  g: Graphics,
  atomA: { x: number; y: number },
  atomB: { x: number; y: number },
  bondType: string,
  isSelected = false
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
    g.stroke({ color: 0x0284c7, width: 10, alpha: 0.35 });
  }

  const color = bondType === "ionic" ? 0x94a3b8 : 0x475569;

  if (bondType === "ionic") {
    const dashLen = 8;
    const gapLen = 4;
    const totalLen = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    const segments = totalLen / (dashLen + gapLen);
    for (let i = 0; i < segments; i++) {
      const t1 = (i * (dashLen + gapLen)) / totalLen;
      const t2 = Math.min(1, (i * (dashLen + gapLen) + dashLen) / totalLen);
      g.moveTo(startX + (endX - startX) * t1, startY + (endY - startY) * t1);
      g.lineTo(startX + (endX - startX) * t2, startY + (endY - startY) * t2);
    }
    g.stroke({ color, width: 3 });
  } else if (bondType === "covalent-double") {
    const perpX = -ny * 4;
    const perpY = nx * 4;
    g.moveTo(startX + perpX, startY + perpY);
    g.lineTo(endX + perpX, endY + perpY);
    g.moveTo(startX - perpX, startY - perpY);
    g.lineTo(endX - perpX, endY - perpY);
    g.stroke({ color, width: 3 });
  } else if (bondType === "covalent-triple") {
    const perpX = -ny * 6;
    const perpY = nx * 6;
    g.moveTo(startX + perpX, startY + perpY);
    g.lineTo(endX + perpX, endY + perpY);
    g.moveTo(startX, startY);
    g.lineTo(endX, endY);
    g.moveTo(startX - perpX, startY - perpY);
    g.lineTo(endX - perpX, endY - perpY);
    g.stroke({ color, width: 3 });
  } else {
    g.moveTo(startX, startY);
    g.lineTo(endX, endY);
    g.stroke({ color, width: 4 });
  }
}
