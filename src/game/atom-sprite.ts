import { Container, FederatedPointerEvent, FillGradient, Graphics, Rectangle, Text } from "pixi.js";
import type { Element } from "@/types";

export const ATOM_RADIUS = 32;
// Minimum effective hit-area radius. Visual atom radius for period-1
// elements (H, He) is ~25px; on a touch screen that's smaller than
// the WCAG 44px target. Setting an explicit hit area on every atom
// guarantees a consistent, generous tap target regardless of period
// scaling. Picked to comfortably exceed 44px diameter.
const HIT_RADIUS = 40;

// Per-element radius scaled by the periodic-table row. Real atomic
// radii span about 7× (H to Cs); we compress that to roughly 1.7×
// so atoms still read together at one zoom level while showing visible
// size differences. "Moving down a row → bigger atom" is the
// pedagogical rule kids learn first; we honor that rather than the
// finer left-right trend (which goes the other way within a row).
const PERIOD_SCALE: Record<number, number> = {
  1: 0.78, // H, He — smallest
  2: 0.92, // Li, Be, B, C, N, O, F, Ne
  3: 1.06, // Na, Mg, Al, Si, P, S, Cl, Ar
  4: 1.18, // K-Kr
  5: 1.26, // Rb-Xe
  6: 1.32, // Cs-Rn
  7: 1.36, // Fr-Og
};

export function getAtomRadius(element: Element): number {
  const scale = PERIOD_SCALE[element.period ?? 2] ?? 1;
  return Math.round(ATOM_RADIUS * scale);
}

export function parseColorToken(token: string): number {
  return parseInt(token.replace("#", ""), 16);
}

/**
 * Lighten (`amount > 0`) or darken (`amount < 0`) a 0xRRGGBB color.
 * `amount` is a 0..1 ratio of the distance toward white or zero.
 */
export function adjustColor(hex: number, amount: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const blend = (channel: number) =>
    amount >= 0
      ? Math.min(255, Math.round(channel + (255 - channel) * amount))
      : Math.max(0, Math.round(channel * (1 + amount)));
  return (blend(r) << 16) | (blend(g) << 8) | blend(b);
}

// Brand green-700 — same color the bond selection halo and overall
// primary palette use, so atoms and bonds share a single "this is
// selected" visual language.
const SELECTION_COLOR = 0x15803d;

/** Re-render the atom body Graphics with the gradient + selection
 *  ring. `radius` is the element-specific radius from getAtomRadius;
 *  callers should pass it to keep the body consistent with shadow,
 *  gloss, and hover halo geometry. */
export function drawAtomBody(
  g: Graphics,
  baseColor: number,
  isSelected: boolean,
  radius: number = ATOM_RADIUS
) {
  g.clear();

  const lightColor = adjustColor(baseColor, 0.45);
  const darkColor = adjustColor(baseColor, -0.22);
  const rimColor = adjustColor(baseColor, -0.35);

  const gradient = new FillGradient({
    type: "radial",
    center: { x: 0.38, y: 0.32 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.55 },
    outerRadius: 0.55,
    colorStops: [
      { offset: 0, color: lightColor },
      { offset: 0.55, color: baseColor },
      { offset: 1, color: darkColor },
    ],
    textureSpace: "local",
  });

  if (isSelected) {
    // Layered halo for more visual presence than a single thin ring —
    // a softer wide outer band plus a brighter inner ring. Drawn before
    // the body so the atom's own gradient/rim renders on top cleanly.
    g.circle(0, 0, radius + 11);
    g.stroke({ width: 3, color: SELECTION_COLOR, alpha: 0.32 });
    g.circle(0, 0, radius + 6);
    g.stroke({ width: 3, color: SELECTION_COLOR, alpha: 0.95 });
  }

  g.circle(0, 0, radius);
  g.fill(gradient);
  g.stroke({ width: 1.5, color: rimColor, alpha: 0.85 });
}

export interface AtomSpriteHandlers {
  onPointerDown: (e: FederatedPointerEvent, atomId: string) => void;
  onContextMenu: (e: FederatedPointerEvent, atomId: string) => void;
  // Read-only check from the caller — true when this atom is currently
  // being dragged. Used by the hover handlers to skip the hover-state
  // scale change so it doesn't fight the drag-lift effect.
  isDragging?: (atomId: string) => boolean;
}

/**
 * Build a fresh atom Container.
 * Children are appended in a fixed order: [hoverHalo, shadow, body,
 * gloss, symbol, name]. `updateAtomSprite` relies on `body` being at
 * index 2.
 */
export function createAtomSprite(
  atom: { id: string; x: number; y: number },
  element: Element,
  handlers: AtomSpriteHandlers
): Container {
  const container = new Container();
  container.x = atom.x;
  container.y = atom.y;
  container.eventMode = "static";
  container.cursor = "pointer";

  const baseColor = parseColorToken(element.colorToken);
  const radius = getAtomRadius(element);

  // Explicit hit area so small (period-1) atoms remain comfortably
  // tappable on touch. We use max(visual radius + buffer, HIT_RADIUS)
  // so atoms larger than the floor keep the bigger target instead of
  // being clipped to a smaller box. Set on the container, not on a
  // child Graphics, so the whole sprite (body + dots + name) shares
  // one unified target.
  const effectiveHitRadius = Math.max(HIT_RADIUS, radius + 4);
  container.hitArea = new Rectangle(
    -effectiveHitRadius,
    -effectiveHitRadius,
    effectiveHitRadius * 2,
    effectiveHitRadius * 2
  );

  // Soft drop shadow underneath the atom
  const shadow = new Graphics();
  shadow.ellipse(0, radius - 2, radius * 0.85, radius * 0.28);
  shadow.fill({ color: 0x000000, alpha: 0.22 });

  // Main 3D-shaded body
  const body = new Graphics();
  drawAtomBody(body, baseColor, false, radius);

  // Glossy highlight near the top to suggest a light source
  const gloss = new Graphics();
  gloss.ellipse(-radius * 0.28, -radius * 0.45, radius * 0.5, radius * 0.28);
  gloss.fill({ color: 0xffffff, alpha: 0.38 });

  const symbol = new Text({
    text: element.symbol,
    style: {
      fontSize: 20,
      fontWeight: "bold",
      fill: 0xffffff,
      align: "center",
      dropShadow: {
        color: 0x000000,
        alpha: 0.45,
        distance: 1,
        blur: 3,
        angle: Math.PI / 2,
      },
    },
  });
  symbol.anchor.set(0.5);

  const nameText = new Text({
    text: element.name,
    style: {
      fontSize: 11,
      fontWeight: "600",
      fill: 0x334155,
      align: "center",
      dropShadow: {
        color: 0xffffff,
        alpha: 0.85,
        distance: 0,
        blur: 4,
        angle: 0,
      },
    },
  });
  nameText.anchor.set(0.5);
  nameText.y = radius + 13;

  // Hover halo — drawn behind everything else, hidden by default.
  // Toggled in the pointerover/pointerout handlers below for a subtle
  // "this atom is interactive" cue. Independent of the selection ring
  // so a hovered-but-not-selected atom still gets feedback.
  const hoverHalo = new Graphics();
  hoverHalo.circle(0, 0, radius + 9);
  hoverHalo.stroke({ width: 3, color: SELECTION_COLOR, alpha: 0.35 });
  hoverHalo.alpha = 0;

  container.addChild(hoverHalo, shadow, body, gloss, symbol, nameText);

  container.on("pointerdown", (e: FederatedPointerEvent) => {
    // button === 2 is right-click; show the delete menu instead of starting a drag.
    if (e.button === 2) {
      handlers.onContextMenu(e, atom.id);
      return;
    }
    handlers.onPointerDown(e, atom.id);
  });
  // Hover feedback is purely visual now — no more "Oxygen (8)" tooltip.
  // The atom is its own label (color + symbol + name underneath).
  // While the atom is being dragged the caller already manages scale
  // (with a slightly larger lift), so the hover handlers bail rather
  // than fight that effect.
  container.on("pointerover", () => {
    if (handlers.isDragging?.(atom.id)) return;
    hoverHalo.alpha = 1;
    container.scale.set(1.06);
  });
  container.on("pointerout", () => {
    if (handlers.isDragging?.(atom.id)) return;
    hoverHalo.alpha = 0;
    container.scale.set(1);
  });

  return container;
}

export function updateAtomSprite(
  sprite: Container,
  atom: { x: number; y: number },
  element: Element,
  isSelected: boolean
) {
  sprite.x = atom.x;
  sprite.y = atom.y;
  // children: [hoverHalo, shadow, body, gloss, symbol, nameText] —
  // body is at index 2 since hoverHalo was added in front.
  const body = sprite.children[2] as Graphics;
  drawAtomBody(
    body,
    parseColorToken(element.colorToken),
    isSelected,
    getAtomRadius(element)
  );
}
