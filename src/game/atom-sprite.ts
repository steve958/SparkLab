import { Container, FederatedPointerEvent, FillGradient, Graphics, Text } from "pixi.js";
import type { Element } from "@/types";

export const ATOM_RADIUS = 32;

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

/** Re-render the atom body Graphics with the gradient + selection ring. */
export function drawAtomBody(g: Graphics, baseColor: number, isSelected: boolean) {
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

  g.circle(0, 0, ATOM_RADIUS);
  g.fill(gradient);
  g.stroke({ width: 1.5, color: rimColor, alpha: 0.85 });

  if (isSelected) {
    g.circle(0, 0, ATOM_RADIUS + 6);
    g.stroke({ width: 3, color: 0x0284c7, alpha: 0.95 });
  }
}

export interface AtomSpriteHandlers {
  onPointerDown: (e: FederatedPointerEvent, atomId: string) => void;
  onHover: (e: FederatedPointerEvent, atomId: string, element: Element) => void;
  onContextMenu: (e: FederatedPointerEvent, atomId: string) => void;
}

/**
 * Build a fresh atom Container.
 * Children are appended in a fixed order: [shadow, body, gloss, symbol, name].
 * `updateAtomSprite` relies on `body` being at index 1.
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

  // Soft drop shadow underneath the atom
  const shadow = new Graphics();
  shadow.ellipse(0, ATOM_RADIUS - 2, ATOM_RADIUS * 0.85, ATOM_RADIUS * 0.28);
  shadow.fill({ color: 0x000000, alpha: 0.22 });

  // Main 3D-shaded body
  const body = new Graphics();
  drawAtomBody(body, baseColor, false);

  // Glossy highlight near the top to suggest a light source
  const gloss = new Graphics();
  gloss.ellipse(-ATOM_RADIUS * 0.28, -ATOM_RADIUS * 0.45, ATOM_RADIUS * 0.5, ATOM_RADIUS * 0.28);
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
  nameText.y = ATOM_RADIUS + 13;

  container.addChild(shadow, body, gloss, symbol, nameText);

  container.on("pointerdown", (e: FederatedPointerEvent) => {
    // button === 2 is right-click; show the delete menu instead of starting a drag.
    if (e.button === 2) {
      handlers.onContextMenu(e, atom.id);
      return;
    }
    handlers.onPointerDown(e, atom.id);
  });
  container.on("pointerover", (e: FederatedPointerEvent) => {
    handlers.onHover(e, atom.id, element);
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
  // children: [shadow, body, gloss, symbol, nameText] — body is at index 1.
  const body = sprite.children[1] as Graphics;
  drawAtomBody(body, parseColorToken(element.colorToken), isSelected);
}
