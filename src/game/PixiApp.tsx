"use client";

import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text, FederatedPointerEvent } from "pixi.js";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import type { Element, SceneState } from "@/types";
import { getElementBySymbol } from "@/data/loader";
import type { ContentBundle } from "@/data/loader";
import { shakeSprite, createTooltip } from "./effects";
import {
  createAtomSprite,
  updateAtomSprite,
  ATOM_RADIUS,
  parseColorToken,
  getAtomRadius,
} from "./atom-sprite";
import { drawBond } from "./bond-graphics";
import { animateScale, animateAlpha } from "./animations";
import { validateBond, getBondsForAtom, countBondOrder } from "@/engine/bond";
import { getBondRulesForPair } from "@/data/loader";

// Brand green — matches --primary in globals.css. Used for the bond
// preview line and snap indicator so the action ties visually to the
// rest of the app's primary affordances.
const BOND_PREVIEW_COLOR = 0x15803d;
// Snap range in scene-local pixels: how close the cursor needs to be to
// an atom for the preview line to "lock on" to it.
const BOND_SNAP_RADIUS = 56;

function bondLabel(bondType: string): string {
  switch (bondType) {
    case "covalent-single":
      return "Single bond";
    case "covalent-double":
      return "Double bond";
    case "covalent-triple":
      return "Triple bond";
    case "ionic":
      return "Ionic bond";
    default:
      return "Bond";
  }
}

// Render the shared-electron dots for every covalent bond in the scene.
// Each pair shows two small dots that oscillate in opposite directions
// along the bond axis, visibly "exchanging" position over a ~2s cycle —
// the visual cue for "covalent = sharing." Single = 1 pair, double = 2,
// triple = 3 pairs (offset perpendicular so they don't overlap).
//
// Ionic is intentionally skipped here. Ionic bonds are electron
// *transfer*, not sharing, and the violet dashed style already conveys
// the difference; adding shared-electron dots would mislabel the
// chemistry.
// Zoom threshold above which the atom reveals its nucleus (Bohr-style
// "look inside the atom" view). Below this, atoms render as their
// normal chemistry symbols only.
const NUCLEUS_ZOOM_THRESHOLD = 1.8;

/** Pack `count` little dots inside a circle of `radius` using a
 *  sunflower (Vogel) spiral so the nucleus looks dense and varied
 *  rather than gridded. Returns positions in atom-local coordinates. */
function nucleonPositions(
  count: number,
  radius: number
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const positions: Array<{ x: number; y: number }> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const angle = i * goldenAngle;
    // sqrt distribution gives uniform area density; 0.85 multiplier
    // keeps dots away from the very edge of the nucleus.
    const r = radius * 0.85 * Math.sqrt((i + 0.5) / count);
    positions.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }
  return positions;
}

/** Draw the nucleus contents for every atom: protons (red) packed
 *  first, then neutrons (slate) filling the rest of the spiral. Only
 *  invoked when zoom is past NUCLEUS_ZOOM_THRESHOLD; below that this
 *  layer is cleared empty. */
function drawNuclei(
  g: Graphics,
  scene: SceneState,
  elements: Element[],
  zoom: number
) {
  g.clear();
  if (zoom < NUCLEUS_ZOOM_THRESHOLD) return;

  for (const atom of scene.atoms) {
    const element = elements.find((e) => e.symbol === atom.elementId);
    if (!element) continue;
    const protons = element.atomicNumber;
    const neutrons = Math.max(
      0,
      Math.round(element.standardAtomicWeight) - protons
    );
    const total = protons + neutrons;
    if (total <= 0) continue;

    const atomRadius = getAtomRadius(element);
    // Nucleus radius scales with atom radius but has a floor so even
    // tiny atoms (period 1) get enough room to read the dots.
    const nucleusRadius = Math.max(atomRadius * 0.42, 12);

    // Soft fill behind the dots so the nucleus reads as a region, not
    // a cloud of unrelated dots.
    g.circle(atom.x, atom.y, nucleusRadius + 2);
    g.fill({ color: 0x0f172a, alpha: 0.18 });

    const positions = nucleonPositions(total, nucleusRadius);
    // Per-dot radius scales with how many we need to pack — bigger
    // dots when there are few, smaller when many. Floor at 1.4 so
    // even high-Z elements stay visible.
    const dotR = Math.max(1.4, nucleusRadius / Math.sqrt(total + 1) * 0.85);

    for (let i = 0; i < total; i++) {
      const p = positions[i];
      const isProton = i < protons;
      g.circle(atom.x + p.x, atom.y + p.y, dotR);
      g.fill({
        color: isProton ? 0xef4444 : 0x94a3b8,
        alpha: 1,
      });
      g.stroke({
        width: 0.4,
        color: isProton ? 0x991b1b : 0x475569,
        alpha: 1,
      });
    }
  }
}

/** Draw Bohr-style electron shells for every atom: thin concentric
 *  rings showing each occupied shell, with electron dots distributed
 *  evenly around each ring and rotating slowly. Different shells
 *  rotate at different rates so the picture stays visually "alive"
 *  rather than locking into a static pattern.
 *
 *  Uses element.shellOccupancy (e.g. O = [2, 6]) at the neutral
 *  configuration. We intentionally don't shrink the outermost shell
 *  for ions — the chemistry of "Na lost an electron" is already
 *  conveyed by the charge pill, and showing the neutral atomic
 *  structure keeps the visual stable while the player builds. */
function drawElectronShells(
  g: Graphics,
  scene: SceneState,
  elements: Element[],
  timeSec: number,
  zoom: number,
  reduceMotion: boolean
) {
  g.clear();
  if (zoom < NUCLEUS_ZOOM_THRESHOLD) return;

  for (const atom of scene.atoms) {
    const element = elements.find((e) => e.symbol === atom.elementId);
    if (!element || !element.shellOccupancy) continue;
    const shells = element.shellOccupancy;
    if (shells.length === 0) continue;

    const atomRadius = getAtomRadius(element);
    const nucleusRadius = Math.max(atomRadius * 0.42, 12);

    // Lay shells out evenly between the nucleus edge and the inner
    // perimeter of the atom body, leaving a small margin so the
    // outermost orbit doesn't crash through the rim.
    const innerEdge = nucleusRadius + 4;
    const outerEdge = atomRadius * 0.93;
    const span = Math.max(0, outerEdge - innerEdge);

    for (let s = 0; s < shells.length; s++) {
      const electronCount = shells[s];
      // Distribute shells through the span so they're not crammed.
      const t = (s + 0.5) / shells.length;
      const shellRadius = innerEdge + span * t;

      // Shell ring — thin and faint so it doesn't compete with the
      // electrons riding it.
      g.circle(atom.x, atom.y, shellRadius);
      g.stroke({ width: 0.7, color: 0x64748b, alpha: 0.35 });

      if (electronCount <= 0) continue;

      // Each shell rotates at a slightly different rate so the visual
      // doesn't flatten into a static rosette. Inner shells nominally
      // orbit faster but we keep all shells slow so the eye reads
      // "atom is alive" rather than "everything is moving."
      const omega = reduceMotion
        ? 0
        : 0.35 * (1 + (shells.length - 1 - s) * 0.25);
      const baseAngle = timeSec * omega + s * 0.7;

      for (let i = 0; i < electronCount; i++) {
        const angle = (i / electronCount) * Math.PI * 2 + baseAngle;
        const ex = atom.x + Math.cos(angle) * shellRadius;
        const ey = atom.y + Math.sin(angle) * shellRadius;
        // Electron — small white dot with a thin outline so it reads
        // as the same "kind of thing" as the Lewis valence dots
        // (which sit at the perimeter of the atom).
        g.circle(ex, ey, 2.2);
        g.fill({ color: 0xffffff, alpha: 1 });
        g.stroke({ width: 0.5, color: 0x334155, alpha: 0.7 });
      }
    }
  }
}

// Standard Lewis-dot layout: number of dots on each side (N, E, S, W),
// filling singles before pairs. Indexed by total dot count 0..8.
const VALENCE_LAYOUTS: Record<number, [number, number, number, number]> = {
  0: [0, 0, 0, 0],
  1: [1, 0, 0, 0],
  2: [1, 0, 1, 0],
  3: [1, 1, 1, 0],
  4: [1, 1, 1, 1],
  5: [2, 1, 1, 1],
  6: [2, 1, 2, 1],
  7: [2, 2, 2, 1],
  8: [2, 2, 2, 2],
};

/** Compute dot positions (in atom-local coords) for `count` valence
 *  electrons around an atom of given radius. Pairs are offset slightly
 *  perpendicular to the radial direction so each pair reads as two
 *  distinct dots. */
function valenceDotPositions(
  count: number,
  radius: number
): Array<{ x: number; y: number }> {
  const layout = VALENCE_LAYOUTS[Math.max(0, Math.min(8, count))] ?? [
    0, 0, 0, 0,
  ];
  const r = radius + 8; // just outside the body
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // N, E, S, W
  const pairOffset = 5;
  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 4; i++) {
    const dots = layout[i];
    const a = angles[i];
    const cx = Math.cos(a) * r;
    const cy = Math.sin(a) * r;
    if (dots === 1) {
      positions.push({ x: cx, y: cy });
    } else if (dots === 2) {
      // Offset perpendicular to radial direction so a "pair" reads as
      // two side-by-side dots rather than overlapping.
      const px = -Math.sin(a);
      const py = Math.cos(a);
      positions.push({ x: cx + px * pairOffset, y: cy + py * pairOffset });
      positions.push({ x: cx - px * pairOffset, y: cy - py * pairOffset });
    }
  }
  return positions;
}

/** Compute the formal charge an atom carries from its ionic bonds.
 *  Sums formalChargeDelta values from each ionic bond's rule, using
 *  whichever side of the rule (atomA or atomB) matches this atom's
 *  element. Returns 0 for purely covalent or unbonded atoms. */
function computeAtomCharge(
  atom: { id: string; elementId: string },
  scene: SceneState,
  bondRules: import("@/types").BondRule[]
): number {
  let charge = 0;
  for (const bond of scene.bonds) {
    if (bond.bondType !== "ionic") continue;
    if (bond.atomAId !== atom.id && bond.atomBId !== atom.id) continue;
    const partnerId =
      bond.atomAId === atom.id ? bond.atomBId : bond.atomAId;
    const partner = scene.atoms.find((a) => a.id === partnerId);
    if (!partner) continue;
    // Find the matching rule. Rules are bidirectional in chemistry but
    // stored with a fixed (atomA, atomB) order in JSON.
    const rule = bondRules.find(
      (r) =>
        r.bondType === "ionic" &&
        ((r.atomA === atom.elementId && r.atomB === partner.elementId) ||
          (r.atomB === atom.elementId && r.atomA === partner.elementId))
    );
    if (!rule) continue;
    if (rule.atomA === atom.elementId) {
      charge += rule.formalChargeDeltaA;
    } else {
      charge += rule.formalChargeDeltaB;
    }
  }
  return charge;
}

/** Standard chemistry charge notation: "+", "−", "2+", "2−" etc.
 *  Magnitude precedes sign for |charge| > 1, per textbook convention. */
function chargeLabel(charge: number): string {
  if (charge === 0) return "";
  // Use the U+2212 minus sign so it's typographically correct, not the
  // ASCII hyphen-minus.
  const sign = charge > 0 ? "+" : "−";
  const mag = Math.abs(charge);
  return mag === 1 ? sign : `${mag}${sign}`;
}

/** Render charge labels on every atom carrying a non-zero formal
 *  charge from ionic bonding. Container is rebuilt every render — fine
 *  because this only fires on scene state change, not per frame. Each
 *  label is a colored pill (background circle + bold text) so it reads
 *  against any atom color and at any zoom. */
function drawAtomCharges(
  container: Container,
  scene: SceneState,
  elements: Element[],
  bondRules: import("@/types").BondRule[]
) {
  // Tear down old labels.
  for (let i = container.children.length - 1; i >= 0; i--) {
    const child = container.children[i];
    container.removeChildAt(i);
    child.destroy();
  }

  for (const atom of scene.atoms) {
    const charge = computeAtomCharge(atom, scene, bondRules);
    if (charge === 0) continue;
    const element = elements.find((e) => e.symbol === atom.elementId);
    if (!element) continue;
    const radius = getAtomRadius(element);

    // Wrapper container so the pill background and the text move
    // together as a unit.
    const pill = new Container();
    // Position: outside the upper-right of the atom body, far enough
    // out that the charge sits clear of the body, the rim, the
    // valence dots (cardinal directions), and the stability ring.
    pill.x = atom.x + radius + 4;
    pill.y = atom.y - radius - 2;

    const text = chargeLabel(charge);
    const fontSize = 22;
    const isPositive = charge > 0;

    const label = new Text({
      text,
      style: {
        fontSize,
        fontWeight: "900",
        fill: 0xffffff,
        align: "center",
      },
    });
    label.anchor.set(0.5);

    // Pill background — sized to the text with a small inset.
    const padX = 8;
    const padY = 3;
    const bgW = label.width + padX * 2;
    const bgH = label.height + padY * 2;
    const bg = new Graphics();
    bg.roundRect(-bgW / 2, -bgH / 2, bgW, bgH, bgH / 2);
    // Positive (cation, electron-poor) = warm red; negative (anion,
    // electron-rich) = cool blue. Vocabulary reinforcement before the
    // words are even introduced.
    bg.fill({ color: isPositive ? 0xdc2626 : 0x2563eb, alpha: 1 });
    bg.stroke({
      width: 2,
      color: isPositive ? 0x991b1b : 0x1e3a8a,
      alpha: 1,
    });

    pill.addChild(bg, label);
    container.addChild(pill);
  }
}

/** Render Lewis-style lone-pair dots around each atom + a subtle
 *  octet-stability ring when the atom has reached a stable
 *  configuration. Shared electrons are already shown by
 *  drawSharedElectrons in the bond region, so they don't appear here.
 *
 *  Ionic vs covalent matters for the count: covalent bonds *share*
 *  electrons (count toward the atom's shell at full bond order × 2),
 *  while ionic bonds *transfer* electrons (the atom either lost or
 *  gained valence electrons cleanly). This function separates the
 *  two so a Cl⁻ shows its full 8 valence electrons and a Na⁺ shows 0.
 */
function drawValenceDots(
  g: Graphics,
  scene: SceneState,
  elements: Element[],
  bondRules: import("@/types").BondRule[]
) {
  g.clear();
  for (const atom of scene.atoms) {
    const element = elements.find((e) => e.symbol === atom.elementId);
    if (!element) continue;
    const valence = element.valenceElectronsMainGroup;
    if (valence <= 0) continue;

    // Ionic transfers shift this atom's effective valence: positive
    // charge = lost electrons, negative = gained.
    const ionicCharge = computeAtomCharge(atom, scene, bondRules);

    // Sum bond orders for *covalent* bonds only.
    let bondedCovalent = 0;
    for (const b of scene.bonds) {
      if (b.atomAId !== atom.id && b.atomBId !== atom.id) continue;
      if (b.bondType === "ionic") continue;
      switch (b.bondType) {
        case "covalent-double":
          bondedCovalent += 2;
          break;
        case "covalent-triple":
          bondedCovalent += 3;
          break;
        case "covalent-single":
        default:
          bondedCovalent += 1;
          break;
      }
    }

    // Effective valence after ionic transfers — Cl⁻ (charge=-1) gains
    // an electron so its effective valence is 8; Na⁺ (charge=+1)
    // loses one so its effective valence is 0.
    const effectiveValence = valence - ionicCharge;
    const lone = Math.max(0, effectiveValence - bondedCovalent);

    // Octet rule: 8 valence electrons in shell for most atoms, 2 for
    // H/He (duet rule). Total shell = 2 * covalent_bond_order + lone
    // (each shared pair counts twice — once for each atom). Ions are
    // always considered stable: they reached noble-gas configuration
    // by transfer rather than by sharing.
    const octetTarget =
      element.symbol === "H" || element.symbol === "He" ? 2 : 8;
    const totalShell = 2 * bondedCovalent + lone;
    const isStable = ionicCharge !== 0 || totalShell === octetTarget;

    const radius = getAtomRadius(element);

    // Stability ring — thin outer outline in brand-aligned green so
    // the pedagogical signal "this atom is stable" is visible without
    // competing with the selection halo.
    if (isStable) {
      g.circle(atom.x, atom.y, radius + 3);
      g.stroke({ width: 1.5, color: 0x16a34a, alpha: 0.55 });
    }

    if (lone === 0) continue;

    const positions = valenceDotPositions(lone, radius);
    for (const p of positions) {
      const dx = atom.x + p.x;
      const dy = atom.y + p.y;
      // Filled white dot with a thin dark outline for definition. No
      // halo (those are reserved for the moving bond electrons).
      g.circle(dx, dy, 2.5);
      g.fill({ color: 0xffffff, alpha: 1 });
      g.stroke({ width: 0.8, color: 0x334155, alpha: 0.7 });
    }
  }
}

function drawSharedElectrons(
  g: Graphics,
  scene: SceneState,
  elements: Element[],
  timeSec: number,
  reduceMotion: boolean
) {
  g.clear();
  const swingPeriod = 2.0; // seconds for one full back-and-forth
  const phaseRate = (Math.PI * 2) / swingPeriod;

  for (const bond of scene.bonds) {
    if (bond.bondType === "ionic") continue;
    const atomA = scene.atoms.find((a) => a.id === bond.atomAId);
    const atomB = scene.atoms.find((a) => a.id === bond.atomBId);
    if (!atomA || !atomB) continue;

    const elementA = elements.find((e) => e.symbol === atomA.elementId);
    const elementB = elements.find((e) => e.symbol === atomB.elementId);
    const rA = elementA ? getAtomRadius(elementA) : ATOM_RADIUS;
    const rB = elementB ? getAtomRadius(elementB) : ATOM_RADIUS;

    const dx = atomB.x - atomA.x;
    const dy = atomB.y - atomA.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Visible portion = full distance minus each atom's actual radius.
    // Skip if atoms overlap or the gap is too narrow for dots.
    const visible = dist - rA - rB;
    if (visible < 24) continue;

    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;

    // Midpoint of the *visible* bond, which shifts toward the smaller
    // atom when the two endpoints have different radii.
    const cx = atomA.x + ux * (rA + visible / 2);
    const cy = atomA.y + uy * (rA + visible / 2);

    const pairs =
      bond.bondType === "covalent-triple"
        ? 3
        : bond.bondType === "covalent-double"
          ? 2
          : 1;
    // Perpendicular spacing has to match the parallel-line spacing in
    // bond-graphics.ts so the dots ride on the actual bond strokes.
    const perpSpacing = pairs === 3 ? 7 : pairs === 2 ? 5 : 0;

    // Amplitude: at most 25% of the visible bond, capped so dots don't
    // crash through the atoms even on long bonds.
    const amplitude = Math.min(visible * 0.18, 14);
    // Half-distance between the two dots in a pair at rest.
    const restGap = Math.min(visible * 0.18, 11);

    for (let p = 0; p < pairs; p++) {
      // Pair offset: -1, 0, +1 (or just 0 for single, -0.5/+0.5 for double).
      const lane = pairs === 1 ? 0 : p - (pairs - 1) / 2;
      const offX = px * perpSpacing * lane;
      const offY = py * perpSpacing * lane;

      // Phase per pair so multiple pairs don't oscillate in lockstep.
      const phase = reduceMotion ? 0 : timeSec * phaseRate + p * 0.7;
      const swing = reduceMotion ? 0 : Math.sin(phase) * amplitude;

      // Two dots per pair. Dot 0 sits left-of-center, dot 1 right-of-
      // center; they swing in opposite directions so the pair visibly
      // "exchanges" through the midpoint each cycle.
      for (let d = 0; d < 2; d++) {
        const dirSign = d === 0 ? -1 : 1;
        const along = dirSign * (restGap + swing * dirSign);
        const ex = cx + offX + ux * along;
        const ey = cy + offY + uy * along;

        // Soft white halo for "glow"
        g.circle(ex, ey, 5);
        g.fill({ color: 0xffffff, alpha: 0.45 });
        // Bright core
        g.circle(ex, ey, 2.4);
        g.fill({ color: 0xffffff, alpha: 1 });
      }
    }
  }
}

interface PixiAppProps {
  content: ContentBundle;
}

export default function PixiApp({ content }: PixiAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneContainerRef = useRef<Container | null>(null);
  const atomsContainerRef = useRef<Container | null>(null);
  const bondsContainerRef = useRef<Container | null>(null);
  const effectsContainerRef = useRef<Container | null>(null);
  const electronsRef = useRef<Graphics | null>(null);
  const electronsTickerRef = useRef<((ticker: { deltaMS: number }) => void) | null>(null);
  const valenceRef = useRef<Graphics | null>(null);
  // Charge labels need Text children, so the charges layer is a
  // Container (not a Graphics that we can g.clear()).
  const chargesRef = useRef<Container | null>(null);
  // Nucleus detail (protons + neutrons) — only drawn when zoom >= 1.8x.
  const nucleiRef = useRef<Graphics | null>(null);
  // Bohr electron shells + orbital electrons — animated, also gated
  // on the same zoom threshold as the nucleus.
  const electronShellsRef = useRef<Graphics | null>(null);
  const atomSpritesRef = useRef<Map<string, Container>>(new Map());
  const bondGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const draggingRef = useRef<{ atomId: string; offsetX: number; offsetY: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuRef = useRef<Container | null>(null);
  const hoverCueRef = useRef<Graphics | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const scene = useGameStore((s) => s.scene);
  const selectedAtomId = useGameStore((s) => s.selectedAtomId);
  const selectedBondId = useGameStore((s) => s.selectedBondId);
  const moveAtom = useGameStore((s) => s.moveAtom);
  const addBond = useGameStore((s) => s.addBond);
  const removeAtom = useGameStore((s) => s.removeAtom);
  const removeBond = useGameStore((s) => s.removeBond);
  const setSelectedAtom = useGameStore((s) => s.setSelectedAtom);
  const setSelectedBond = useGameStore((s) => s.setSelectedBond);
  const settings = useProgressStore((s) => s.settings);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let mountedCanvas: HTMLCanvasElement | null = null;

    async function init() {
      const app = new Application();
      await app.init({
        resizeTo: container ?? undefined,
        backgroundColor: 0xf8fafc,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: "webgl",
      });

      if (destroyed || !container) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
        return;
      }

      const pixiCanvas = app.canvas as HTMLCanvasElement;
      pixiCanvas.style.display = "block";
      pixiCanvas.style.width = "100%";
      pixiCanvas.style.height = "100%";
      pixiCanvas.style.touchAction = "none";
      pixiCanvas.style.userSelect = "none";
      pixiCanvas.setAttribute("aria-label", "Chemistry game scene. Use keyboard or touch controls to interact.");
      pixiCanvas.setAttribute("role", "img");
      pixiCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
      container.appendChild(pixiCanvas);
      mountedCanvas = pixiCanvas;

      appRef.current = app;

      const sceneContainer = new Container();
      sceneContainer.sortableChildren = true;
      app.stage.addChild(sceneContainer);
      sceneContainerRef.current = sceneContainer;

      const bondsContainer = new Container();
      bondsContainer.zIndex = 1;
      sceneContainer.addChild(bondsContainer);
      bondsContainerRef.current = bondsContainer;

      // Shared-electron dots layer — rendered above bond strokes but
      // below atoms so the dots ride on top of the bond and tuck
      // visually into each atom. Animated via the Pixi Ticker below.
      const electronsG = new Graphics();
      electronsG.zIndex = 1.5;
      sceneContainer.addChild(electronsG);
      electronsRef.current = electronsG;

      const atomsContainer = new Container();
      atomsContainer.zIndex = 2;
      sceneContainer.addChild(atomsContainer);
      atomsContainerRef.current = atomsContainer;

      // Valence-dot (Lewis lone-pair) layer — sits just above atoms so
      // the dots render on top of the atom body but below interactive
      // effects. Updated from the scene-render effect (no animation).
      const valenceG = new Graphics();
      valenceG.zIndex = 2.5;
      sceneContainer.addChild(valenceG);
      valenceRef.current = valenceG;

      // Charge-label layer — Text children for "+", "−", "2+", etc.
      // Same render cadence as valence dots.
      const chargesContainer = new Container();
      chargesContainer.zIndex = 2.6;
      sceneContainer.addChild(chargesContainer);
      chargesRef.current = chargesContainer;

      // Nucleus detail layer. zIndex 2.4 so it sits between atom body
      // (2) and charges/valence (2.5+). Only populated when zoom is
      // high enough to read the protons + neutrons.
      const nucleiG = new Graphics();
      nucleiG.zIndex = 2.4;
      sceneContainer.addChild(nucleiG);
      nucleiRef.current = nucleiG;

      // Bohr shell layer — concentric rings + orbital electrons that
      // rotate around the nucleus. Sits above the nucleus dots but
      // below the outer Lewis dots and charge pills, so the orbital
      // structure renders inside the atom body without occluding the
      // chemistry decorations on the perimeter.
      const shellsG = new Graphics();
      shellsG.zIndex = 2.45;
      sceneContainer.addChild(shellsG);
      electronShellsRef.current = shellsG;

      const effectsContainer = new Container();
      effectsContainer.zIndex = 3;
      sceneContainer.addChild(effectsContainer);
      effectsContainerRef.current = effectsContainer;

      // Per-frame redraw of the shared-electron dots. Cheap because
      // each bond contributes only 2-6 small circles. Throttled to
      // roughly 30 fps so we're not redrawing for sub-pixel changes.
      let lastTickMs = 0;
      const electronsTick = (ticker: { deltaMS: number }) => {
        lastTickMs += ticker.deltaMS;
        if (lastTickMs < 33) return; // ~30 fps
        lastTickMs = 0;
        const reduceMotion =
          useProgressStore.getState().settings?.reducedMotion ?? false;
        const scene = useGameStore.getState().scene;
        const tSec = performance.now() / 1000;

        if (electronsRef.current) {
          drawSharedElectrons(
            electronsRef.current,
            scene,
            content.elements,
            tSec,
            reduceMotion
          );
        }
        // Bohr orbital electrons — the per-atom shell rotation. The
        // function early-exits if zoom is below the nucleus-detail
        // threshold so the layer stays empty at normal zoom.
        if (electronShellsRef.current) {
          drawElectronShells(
            electronShellsRef.current,
            scene,
            content.elements,
            tSec,
            zoomRef.current,
            reduceMotion
          );
        }
      };
      app.ticker.add(electronsTick);
      electronsTickerRef.current = electronsTick;

      // Enable interactivity
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      // Background drag pans the view; a quick tap clears selection.
      // Atoms still move only via their own drag handler. Same drag-
      // detection pattern used for atom drag: if pointer travels > 5px
      // before pointerup, treat as pan; else as a tap.
      app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
        if (e.target !== app.stage) return;

        const startX = e.globalX;
        const startY = e.globalY;
        const startPanX = panRef.current.x;
        const startPanY = panRef.current.y;
        let isPanning = false;
        const previousCursor = pixiCanvas.style.cursor;

        const onMove = (ev: FederatedPointerEvent) => {
          const dx = ev.globalX - startX;
          const dy = ev.globalY - startY;
          if (!isPanning && Math.sqrt(dx * dx + dy * dy) > 5) {
            isPanning = true;
            pixiCanvas.style.cursor = "grabbing";
          }
          if (isPanning) {
            panRef.current.x = startPanX + dx;
            panRef.current.y = startPanY + dy;
            sceneContainer.x = panRef.current.x;
            sceneContainer.y = panRef.current.y;
          }
        };

        const onUp = () => {
          if (!isPanning) {
            // Quick tap on the background — preserve the original
            // clear-selection behavior.
            const state = useGameStore.getState();
            if (state.selectedBondId) setSelectedBond(null);
            if (state.selectedAtomId) setSelectedAtom(null);
            dismissContextMenu();
          }
          pixiCanvas.style.cursor = previousCursor;
          app.stage.off("globalpointermove", onMove);
          app.stage.off("pointerup", onUp);
          app.stage.off("pointerupoutside", onUp);
        };

        app.stage.on("globalpointermove", onMove);
        app.stage.on("pointerup", onUp);
        app.stage.on("pointerupoutside", onUp);
      });

      // Global pointer move for hover cues — coalesce to one update per animation
      // frame so the O(atoms) distance scan doesn't run 100+ times per second.
      app.stage.on("pointermove", (e: FederatedPointerEvent) => {
        pendingHoverPosRef.current = { x: e.globalX, y: e.globalY };
        if (hoverRafRef.current !== null) return;
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = null;
          const pos = pendingHoverPosRef.current;
          if (!pos) return;
          updateHoverCue(pos.x, pos.y, sceneContainer);
        });
      });

      // Zoom with mouse wheel — anchored to the cursor position so the
      // scene point under the pointer stays fixed during zoom (much
      // nicer feel once the player has panned somewhere).
      pixiCanvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const oldZoom = zoomRef.current;
          const zoomSpeed = 0.001;
          const newZoom = Math.max(
            0.5,
            Math.min(3, oldZoom - e.deltaY * zoomSpeed)
          );
          if (newZoom === oldZoom) return;

          const rect = pixiCanvas.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          // Scene-local point under the cursor before zoom changes.
          const sceneX = (cx - panRef.current.x) / oldZoom;
          const sceneY = (cy - panRef.current.y) / oldZoom;

          zoomRef.current = newZoom;
          sceneContainer.scale.set(newZoom);
          // Re-anchor pan so the same scene point stays under the cursor.
          panRef.current.x = cx - sceneX * newZoom;
          panRef.current.y = cy - sceneY * newZoom;
          sceneContainer.x = panRef.current.x;
          sceneContainer.y = panRef.current.y;

          // Nucleus + shell visibility is zoom-gated — redraw both
          // whenever the crossing happens (and on the way out too,
          // so the layers clear when zooming back below threshold).
          const scene = useGameStore.getState().scene;
          if (nucleiRef.current) {
            drawNuclei(
              nucleiRef.current,
              scene,
              content.elements,
              newZoom
            );
          }
          if (electronShellsRef.current) {
            const reduceMotion =
              useProgressStore.getState().settings?.reducedMotion ?? false;
            drawElectronShells(
              electronShellsRef.current,
              scene,
              content.elements,
              performance.now() / 1000,
              newZoom,
              reduceMotion
            );
          }
        },
        { passive: false }
      );
    }

    init().catch((err) => {
      console.error("PixiApp init failed:", err);
    });

    return () => {
      destroyed = true;
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      pendingHoverPosRef.current = null;
      if (appRef.current && electronsTickerRef.current) {
        // Detach the per-frame electrons callback before destroying
        // the app — leaving it attached against a destroyed app would
        // throw on the next frame.
        try {
          appRef.current.ticker.remove(electronsTickerRef.current);
        } catch {
          // already detached
        }
        electronsTickerRef.current = null;
      }
      electronsRef.current = null;
      valenceRef.current = null;
      chargesRef.current = null;
      nucleiRef.current = null;
      electronShellsRef.current = null;
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true, texture: true, textureSource: true });
        } catch (err) {
          console.warn("PixiApp destroy error:", err);
        }
        appRef.current = null;
      }
      if (mountedCanvas && mountedCanvas.parentElement === container) {
        container.removeChild(mountedCanvas);
      }
      mountedCanvas = null;
      // Clear refs so Strict Mode re-mounts don't try to reuse destroyed sprites
      atomSpritesRef.current.clear();
      bondGraphicsRef.current.clear();
    };
  }, [setSelectedAtom]);

  // Listen for invalid actions to trigger shake
  useEffect(() => {
    const handler = () => {
      const selectedId = useGameStore.getState().selectedAtomId;
      if (!selectedId) return;
      const sprite = atomSpritesRef.current.get(selectedId);
      if (sprite) {
        shakeSprite(sprite, 8, 300);
      }
    };
    window.addEventListener("sparklab-invalid-action", handler);
    return () => window.removeEventListener("sparklab-invalid-action", handler);
  }, []);

  // Render atoms whenever scene changes
  useEffect(() => {
    const atomsContainer = atomsContainerRef.current;
    const bondsContainer = bondsContainerRef.current;
    if (!atomsContainer || !bondsContainer) return;

    const reducedMotion = settings?.reducedMotion ?? false;

    // Sync atoms
    const currentIds = new Set(scene.atoms.map((a) => a.id));
    const spriteIds = new Set(atomSpritesRef.current.keys());

    // Remove deleted atoms
    for (const id of spriteIds) {
      if (!currentIds.has(id)) {
        const sprite = atomSpritesRef.current.get(id);
        if (sprite) {
          if (!reducedMotion) {
            animateScale(sprite, 1, 0, 150, () => {
              sprite.destroy({ children: true });
            });
          } else {
            sprite.destroy({ children: true });
          }
        }
        atomSpritesRef.current.delete(id);
      }
    }

    // Add or update atoms
    for (const atom of scene.atoms) {
      const element = getElementBySymbol(content.elements, atom.elementId);
      if (!element) continue;

      let sprite = atomSpritesRef.current.get(atom.id);
      if (!sprite) {
        sprite = createAtomSprite(atom, element, {
          onPointerDown: handleAtomPointerDown,
          onContextMenu: handleAtomContextMenu,
        });
        atomsContainer.addChild(sprite);
        atomSpritesRef.current.set(atom.id, sprite);
        if (!reducedMotion) {
          animateScale(sprite, 0, 1, 200);
        }
      } else {
        updateAtomSprite(sprite, atom, element, selectedAtomId === atom.id);
      }
    }

    // Sync bonds
    const currentBondIds = new Set(scene.bonds.map((b) => b.id));
    const bondIds = new Set(bondGraphicsRef.current.keys());

    for (const id of bondIds) {
      if (!currentBondIds.has(id)) {
        const g = bondGraphicsRef.current.get(id);
        if (g) {
          g.clear();
          g.destroy();
        }
        bondGraphicsRef.current.delete(id);
      }
    }

    // Build an id->atom index once so bond rendering is O(bonds + atoms) instead of O(bonds * atoms).
    const atomById = new Map(scene.atoms.map((a) => [a.id, a]));

    for (const bond of scene.bonds) {
      const atomA = atomById.get(bond.atomAId);
      const atomB = atomById.get(bond.atomBId);
      if (!atomA || !atomB) continue;

      let g = bondGraphicsRef.current.get(bond.id);
      let isNewBond = false;
      if (!g) {
        g = new Graphics();
        g.eventMode = "static";
        g.cursor = "pointer";
        const bondId = bond.id;
        g.on("pointerdown", (e: FederatedPointerEvent) =>
          handleBondPointerDown(e, bondId)
        );
        // Hover tooltip — surfaces the bond *type* on hover so the
        // single/double/triple distinction in the visuals is also
        // available as text. Mirrors the atom hover pattern.
        g.on("pointerover", () => handleBondHover(bondId));
        bondsContainer.addChild(g);
        bondGraphicsRef.current.set(bond.id, g);
        isNewBond = true;
      }
      // Look up element colors AND radii so the bond inner stroke can
      // gradient between the two endpoints' atom palettes (H-O →
      // blue→red, etc.) AND stop short at each atom's actual visible
      // edge so a small H next to a large Cl looks right.
      const elementA = getElementBySymbol(content.elements, atomA.elementId);
      const elementB = getElementBySymbol(content.elements, atomB.elementId);
      const colorA = elementA ? parseColorToken(elementA.colorToken) : undefined;
      const colorB = elementB ? parseColorToken(elementB.colorToken) : undefined;
      const rA = elementA ? getAtomRadius(elementA) : ATOM_RADIUS;
      const rB = elementB ? getAtomRadius(elementB) : ATOM_RADIUS;
      drawBond(
        g,
        atomA,
        atomB,
        bond.bondType,
        selectedBondId === bond.id,
        colorA,
        colorB,
        rA,
        rB
      );
      if (isNewBond && !reducedMotion) {
        // New bonds fade in over ~180ms — matches the atom-spawn
        // animation cadence so the scene feels coherent. Reduced-motion
        // users get the bond at full alpha immediately. Graphics
        // extends Container, so the alpha tween targets the same
        // displayObject API as atom sprites.
        animateAlpha(g, 0, 1, 180);
      }
    }

    // Valence-dot pass: redraw lone pairs every time bonds change.
    // Static (no animation), so it lives in this scene-driven effect
    // rather than in the per-frame Ticker like the shared electrons.
    if (valenceRef.current) {
      drawValenceDots(
        valenceRef.current,
        scene,
        content.elements,
        content.bondRules
      );
    }
    // Charge-label pass: only ionic atoms get a label, and the value
    // depends on which ionic bonds the atom is in, so this also
    // recomputes whenever bonds change.
    if (chargesRef.current) {
      drawAtomCharges(
        chargesRef.current,
        scene,
        content.elements,
        content.bondRules
      );
    }
    // Nucleus pass: only renders when the player has zoomed in
    // enough. Re-runs on scene change so newly added atoms get their
    // nuclei drawn at the current zoom.
    if (nucleiRef.current) {
      drawNuclei(
        nucleiRef.current,
        scene,
        content.elements,
        zoomRef.current
      );
    }
  }, [scene, selectedAtomId, selectedBondId, content.elements, content.bondRules, settings]);

  function dismissContextMenu() {
    if (contextMenuRef.current) {
      contextMenuRef.current.destroy({ children: true });
      contextMenuRef.current = null;
    }
  }

  function showContextMenu(
    globalX: number,
    globalY: number,
    labelText: string,
    onConfirm: () => void
  ) {
    dismissContextMenu();
    const effectsContainer = effectsContainerRef.current;
    const sceneContainer = sceneContainerRef.current;
    if (!effectsContainer || !sceneContainer) return;

    // Menus are children of the scene, so place them in scene-local coords.
    const localPos = sceneContainer.toLocal({ x: globalX, y: globalY });
    const menu = new Container();
    menu.x = localPos.x;
    menu.y = localPos.y;

    const padX = 14;
    const padY = 10;
    const label = new Text({
      text: labelText,
      style: { fontSize: 14, fill: 0xef4444, fontWeight: "bold" },
    });
    label.anchor.set(0.5);
    label.eventMode = "static";
    label.cursor = "pointer";

    const bgWidth = label.width + padX * 2;
    const bgHeight = label.height + padY * 2;
    const bg = new Graphics();
    bg.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 8);
    bg.fill(0xffffff, 0.95);
    bg.stroke({ width: 1, color: 0xe2e8f0 });
    bg.eventMode = "static";
    bg.cursor = "pointer";

    const onConfirmDown = (e: FederatedPointerEvent) => {
      e.stopPropagation();
      onConfirm();
      dismissContextMenu();
    };
    label.on("pointerdown", onConfirmDown);
    bg.on("pointerdown", onConfirmDown);

    menu.addChild(bg, label);
    effectsContainer.addChild(menu);
    contextMenuRef.current = menu;
  }

  function handleAtomContextMenu(e: FederatedPointerEvent, atomId: string) {
    e.stopPropagation();
    showContextMenu(e.globalX, e.globalY + 8, "Delete atom", () => removeAtom(atomId));
  }

  function handleBondPointerDown(e: FederatedPointerEvent, bondId: string) {
    e.stopPropagation();
    dismissContextMenu();

    // Right-click → "Delete bond" menu directly, parallel to how atoms
    // route right-click straight to context menu in atom-sprite.ts.
    if (e.button === 2) {
      showContextMenu(e.globalX, e.globalY - 12, "Delete bond", () =>
        removeBond(bondId)
      );
      return;
    }

    const app = appRef.current;
    if (!app) return;

    const startX = e.globalX;
    const startY = e.globalY;
    const startTime = Date.now();
    let triggeredLongPress = false;

    // Mirror the atom interaction model: tap = select, long-press =
    // "Delete bond" context menu. The previous code popped the delete
    // menu on every tap, which made bonds feel aggressively
    // destructive compared to atoms.
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      triggeredLongPress = true;
      // Anchor the menu near where the press happened — bonds are long
      // and the midpoint can be far from the cursor.
      showContextMenu(startX, startY - 12, "Delete bond", () =>
        removeBond(bondId)
      );
    }, 600);

    const onMove = (ev: FederatedPointerEvent) => {
      const dx = ev.globalX - startX;
      const dy = ev.globalY - startY;
      if (
        longPressTimerRef.current &&
        Math.sqrt(dx * dx + dy * dy) > 5
      ) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onUp = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const wasQuickTap =
        !triggeredLongPress && Date.now() - startTime < 400;
      if (wasQuickTap) {
        // Toggle selection so a second tap on the same bond clears it.
        const state = useGameStore.getState();
        setSelectedBond(state.selectedBondId === bondId ? null : bondId);
      }
      app.stage.off("globalpointermove", onMove);
      app.stage.off("pointerup", onUp);
      app.stage.off("pointerupoutside", onUp);
    };

    app.stage.on("globalpointermove", onMove);
    app.stage.on("pointerup", onUp);
    app.stage.on("pointerupoutside", onUp);
  }

  function handleAtomPointerDown(
    e: FederatedPointerEvent,
    atomId: string
  ) {
    e.stopPropagation();
    dismissContextMenu();

    const sprite = atomSpritesRef.current.get(atomId);
    if (!sprite) return;

    const startX = e.globalX;
    const startY = e.globalY;
    const startTime = Date.now();
    let isDragging = false;

    // Capture the previously selected atom so a tap-tap can bond them.
    // Selection is updated on pointerup (or as soon as a drag begins).
    const previouslySelectedId = useGameStore.getState().selectedAtomId;

    const app = appRef.current;
    if (!app) return;

    // Long-press timer
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      const pos = sprite.getGlobalPosition();
      showContextMenu(pos.x, pos.y + 40, "Delete atom", () => removeAtom(atomId));
    }, 600);

    const onMove = (ev: FederatedPointerEvent) => {
      const dx = ev.globalX - startX;
      const dy = ev.globalY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Cancel long-press only on real movement, otherwise sub-pixel jitter
      // (especially on desktop trackpads) kills the timer immediately.
      if (dist > 5 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (!isDragging && dist > 5) {
        isDragging = true;
        // Once we know it's a drag, take selection so the move/highlight tracks this atom.
        setSelectedAtom(atomId);
        const globalPos = sprite.getGlobalPosition();
        draggingRef.current = {
          atomId,
          offsetX: ev.globalX - globalPos.x,
          offsetY: ev.globalY - globalPos.y,
        };
      }

      if (isDragging && draggingRef.current) {
        const sceneContainer = sceneContainerRef.current;
        if (!sceneContainer) return;
        const localPos = sceneContainer.toLocal({
          x: ev.globalX - draggingRef.current.offsetX,
          y: ev.globalY - draggingRef.current.offsetY,
        });
        moveAtom(draggingRef.current.atomId, localPos.x, localPos.y);
      }
    };

    const onUp = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const duration = Date.now() - startTime;

      if (!isDragging && duration < 400 && !contextMenuRef.current) {
        // Treat as a tap. Bond against whatever was selected BEFORE this tap, then
        // update selection here (rather than on pointerdown) so re-tapping the same
        // atom toggles selection cleanly and tap-tap on two different atoms bonds them.
        handleAtomTap(atomId, previouslySelectedId);
      }

      draggingRef.current = null;
      app.stage.off("globalpointermove", onMove);
      app.stage.off("pointerup", onUp);
      app.stage.off("pointerupoutside", onUp);
    };

    app.stage.on("globalpointermove", onMove);
    app.stage.on("pointerup", onUp);
    app.stage.on("pointerupoutside", onUp);
  }

  function handleAtomTap(atomId: string, previouslySelectedId: string | null) {
    if (previouslySelectedId && previouslySelectedId !== atomId) {
      // B2: rule-driven bond-type selection. Look up the (elementA,
      // elementB, ageBand) tuple in bond_rules.json via validateBond
      // and create the bond at the *curriculum-correct* type. CO2 at
      // age 11–14 forms double bonds automatically; N2 forms triple;
      // NaCl forms ionic; etc. Falls back to single covalent for pairs
      // with no authored rule (preserves existing missions that
      // pre-date the rule set).
      const state = useGameStore.getState();
      const profileState = useProgressStore.getState();
      const ageBand = profileState.currentProfile?.ageBand ?? "8-10";

      const atomA = state.scene.atoms.find((a) => a.id === previouslySelectedId);
      const atomB = state.scene.atoms.find((a) => a.id === atomId);
      const elementA = atomA
        ? getElementBySymbol(content.elements, atomA.elementId)
        : null;
      const elementB = atomB
        ? getElementBySymbol(content.elements, atomB.elementId)
        : null;

      let bondType: "covalent-single" | "covalent-double" | "covalent-triple" | "ionic" =
        "covalent-single";
      if (atomA && atomB && elementA && elementB) {
        // Look up rules first so we can distinguish "no rule for this
        // pair" (permissive fallback to single covalent) from "rule
        // exists but the player has exhausted this atom's valence"
        // (genuine pedagogical correction — surface the explanation
        // and don't create a misleading bond). validateBond conflates
        // these cases, so we check the rule list directly.
        const matchingRules = getBondRulesForPair(
          content.bondRules,
          elementA.symbol,
          elementB.symbol,
          ageBand
        );
        if (matchingRules.length === 0) {
          // No authored rule for this pair (bond_rules.json is
          // incomplete content). Fall back to a single covalent bond
          // so gameplay isn't blocked by missing data.
          bondType = "covalent-single";
        } else {
          const aBonds = countBondOrder(
            getBondsForAtom(previouslySelectedId, state.scene.bonds)
          );
          const bBonds = countBondOrder(
            getBondsForAtom(atomId, state.scene.bonds)
          );
          const result = validateBond(
            content.bondRules,
            elementA,
            elementB,
            ageBand,
            aBonds,
            bBonds
          );
          if (result.valid && result.bondType) {
            bondType = result.bondType;
          } else {
            // Rule exists but valence is exhausted.
            state.showFeedback(
              result.explanation,
              "error"
            );
            window.dispatchEvent(new CustomEvent("sparklab-invalid-action"));
            setSelectedAtom(atomId);
            return;
          }
        }
      }

      const bond = {
        id: crypto.randomUUID(),
        atomAId: previouslySelectedId,
        atomBId: atomId,
        bondType,
      };
      addBond(bond);
      setSelectedAtom(atomId);
      return;
    }
    // First tap on this atom (or repeat tap on the already-selected atom): select it.
    setSelectedAtom(atomId);
  }

  function updateHoverCue(globalX: number, globalY: number, sceneContainer: Container) {
    const effectsContainer = effectsContainerRef.current;
    if (!effectsContainer) return;

    const state = useGameStore.getState();
    const selectedId = state.selectedAtomId;

    if (!selectedId) {
      if (hoverCueRef.current) {
        hoverCueRef.current.clear();
        hoverCueRef.current = null;
      }
      return;
    }

    const localPos = sceneContainer.toLocal({ x: globalX, y: globalY });
    const sourceAtom = state.scene.atoms.find((a) => a.id === selectedId);
    if (!sourceAtom) return;
    const sourceElement = getElementBySymbol(
      content.elements,
      sourceAtom.elementId
    );
    const sourceRadius = sourceElement
      ? getAtomRadius(sourceElement)
      : ATOM_RADIUS;

    // Find the nearest non-self atom within the snap range. The preview
    // line locks on to it; otherwise it follows the cursor.
    let snapTarget: { x: number; y: number; id: string } | null = null;
    let snapDistSq = BOND_SNAP_RADIUS * BOND_SNAP_RADIUS;
    for (const atom of state.scene.atoms) {
      if (atom.id === selectedId) continue;
      const dx = atom.x - localPos.x;
      const dy = atom.y - localPos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < snapDistSq) {
        snapDistSq = d2;
        snapTarget = { x: atom.x, y: atom.y, id: atom.id };
      }
    }

    // Suppress the preview if a bond already exists between the source
    // and the snap target — visually misleading to draw a "form bond"
    // hint on a pair that's already bonded.
    if (snapTarget) {
      const already = state.scene.bonds.some(
        (b) =>
          (b.atomAId === selectedId && b.atomBId === snapTarget!.id) ||
          (b.atomAId === snapTarget!.id && b.atomBId === selectedId)
      );
      if (already) snapTarget = null;
    }

    if (!hoverCueRef.current) {
      hoverCueRef.current = new Graphics();
      effectsContainer.addChild(hoverCueRef.current);
    }
    const g = hoverCueRef.current;
    g.clear();

    // Endpoint: target atom center if snapping, else cursor position.
    const endX = snapTarget ? snapTarget.x : localPos.x;
    const endY = snapTarget ? snapTarget.y : localPos.y;

    // Per-atom radius lookup so the preview line tucks neatly into
    // the actual edges of differently-sized atoms.
    let targetRadius = ATOM_RADIUS;
    if (snapTarget) {
      const targetAtom = state.scene.atoms.find(
        (a) => a.id === snapTarget!.id
      );
      const targetElement = targetAtom
        ? getElementBySymbol(content.elements, targetAtom.elementId)
        : null;
      targetRadius = targetElement
        ? getAtomRadius(targetElement)
        : ATOM_RADIUS;
    }

    const dx = endX - sourceAtom.x;
    const dy = endY - sourceAtom.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > sourceRadius + 4) {
      const ux = dx / dist;
      const uy = dy / dist;
      const startX = sourceAtom.x + ux * sourceRadius;
      const startY = sourceAtom.y + uy * sourceRadius;
      // When snapping, end before the target atom; otherwise stop at
      // the cursor itself.
      const stopShort = snapTarget ? targetRadius : 0;
      const lineEndX = endX - ux * stopShort;
      const lineEndY = endY - uy * stopShort;

      // Hand-drawn dashes — Pixi v8 stroke doesn't ship a dash API.
      const dash = 8;
      const gap = 5;
      const total = Math.sqrt(
        (lineEndX - startX) ** 2 + (lineEndY - startY) ** 2
      );
      let traveled = 0;
      while (traveled < total) {
        const t1 = traveled / total;
        const t2 = Math.min(1, (traveled + dash) / total);
        g.moveTo(
          startX + (lineEndX - startX) * t1,
          startY + (lineEndY - startY) * t1
        );
        g.lineTo(
          startX + (lineEndX - startX) * t2,
          startY + (lineEndY - startY) * t2
        );
        traveled += dash + gap;
      }
      g.stroke({
        width: snapTarget ? 4 : 3,
        color: snapTarget ? BOND_PREVIEW_COLOR : 0x64748b,
        alpha: snapTarget ? 0.85 : 0.5,
      });
    }

    if (snapTarget) {
      // Snap indicator: a soft glowing ring on the target atom, signalling
      // "release here to bond". Two concentric circles for a halo feel.
      // Sized to the target atom's actual radius so it hugs the edge.
      g.circle(snapTarget.x, snapTarget.y, targetRadius + 6);
      g.stroke({ width: 3, color: BOND_PREVIEW_COLOR, alpha: 0.85 });
      g.circle(snapTarget.x, snapTarget.y, targetRadius + 11);
      g.stroke({ width: 2, color: BOND_PREVIEW_COLOR, alpha: 0.35 });
    }
    // No move cue any more — clicking empty canvas clears the selection,
    // it doesn't relocate the atom (atoms move only via drag).
  }

  function handleBondHover(bondId: string) {
    if (draggingRef.current) return;
    const effectsContainer = effectsContainerRef.current;
    const sceneContainer = sceneContainerRef.current;
    if (!effectsContainer || !sceneContainer) return;
    const state = useGameStore.getState();
    const bond = state.scene.bonds.find((b) => b.id === bondId);
    if (!bond) return;
    const atomA = state.scene.atoms.find((a) => a.id === bond.atomAId);
    const atomB = state.scene.atoms.find((a) => a.id === bond.atomBId);
    if (!atomA || !atomB) return;
    const midX = (atomA.x + atomB.x) / 2;
    const midY = (atomA.y + atomB.y) / 2;
    const globalPos = sceneContainer.toGlobal({ x: midX, y: midY });
    createTooltip(
      effectsContainer,
      globalPos.x,
      globalPos.y,
      bondLabel(bond.bondType)
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full block relative"
      style={{ touchAction: "none", userSelect: "none" }}
    />
  );
}

