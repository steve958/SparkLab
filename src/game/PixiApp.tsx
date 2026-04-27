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
// "look inside the atom" view). Below FADE_START the layers are
// hidden entirely; between FADE_START and the threshold they crossfade
// in so popping in/out of Bohr mode doesn't feel abrupt.
const NUCLEUS_ZOOM_THRESHOLD = 1.8;
const NUCLEUS_FADE_START = 1.6;

function bohrFade(zoom: number): number {
  if (zoom <= NUCLEUS_FADE_START) return 0;
  if (zoom >= NUCLEUS_ZOOM_THRESHOLD) return 1;
  return (zoom - NUCLEUS_FADE_START) / (NUCLEUS_ZOOM_THRESHOLD - NUCLEUS_FADE_START);
}

/** Apply an ionic charge to a neutral shell occupancy by removing
 *  electrons from the outermost shell(s) for cations and adding them
 *  to the outermost shell for anions. Trailing empty shells are
 *  dropped so Na⁺ (originally [2,8,1]) renders as [2,8] rather than
 *  a leftover empty ring. */
function effectiveShellOccupancy(
  baseShells: number[],
  ionicCharge: number
): number[] {
  if (ionicCharge === 0 || baseShells.length === 0) return baseShells;
  const shells = [...baseShells];
  if (ionicCharge > 0) {
    // Cation: peel electrons off the outermost shells until charge is
    // satisfied. Standard ionic chemistry has charge ≤ outer shell, so
    // the loop usually exits on the outermost shell.
    let toRemove = ionicCharge;
    for (let i = shells.length - 1; i >= 0 && toRemove > 0; i--) {
      const remove = Math.min(shells[i], toRemove);
      shells[i] -= remove;
      toRemove -= remove;
    }
    while (shells.length > 0 && shells[shells.length - 1] === 0) {
      shells.pop();
    }
  } else {
    // Anion: add to outermost shell (typically completing the octet).
    shells[shells.length - 1] += -ionicCharge;
  }
  return shells;
}

/** Pack `count` little dots inside a circle of `radius` using a
 *  sunflower (Vogel) spiral so the nucleus looks dense and varied
 *  rather than gridded. Returns positions in atom-local coordinates. */
function nucleonPositions(
  count: number,
  radius: number
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  // Single-nucleon case (hydrogen: 1 proton, 0 neutrons) goes dead
  // center. The sunflower formula below gives r = 0.6 × radius for
  // i=0/count=1, which is mathematically the area-centroid of a
  // 1-disk distribution but visually reads as the proton drifting off
  // to the right. A single particle should sit at the nucleus center.
  if (count === 1) return [{ x: 0, y: 0 }];
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
  const fade = bohrFade(zoom);
  if (fade <= 0) return;
  g.alpha = fade;

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
 *  Per-atom shell occupancy is the neutral configuration adjusted for
 *  any ionic charge — Na⁺ visibly drops its outer-shell electron,
 *  Cl⁻ visibly gains one. Ties the Bohr view back to the chemistry
 *  the rest of the visualization (Lewis dots, charge pill) is showing. */
function drawElectronShells(
  g: Graphics,
  scene: SceneState,
  elements: Element[],
  bondRules: import("@/types").BondRule[],
  timeSec: number,
  zoom: number,
  reduceMotion: boolean
) {
  g.clear();
  const fade = bohrFade(zoom);
  if (fade <= 0) return;
  g.alpha = fade;

  for (const atom of scene.atoms) {
    const element = elements.find((e) => e.symbol === atom.elementId);
    if (!element || !element.shellOccupancy) continue;
    const ionicCharge = computeAtomCharge(atom, scene, bondRules);
    const shells = effectiveShellOccupancy(
      element.shellOccupancy,
      ionicCharge
    );
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
 *  configuration. Shared electrons are visualized by drawBondFlow
 *  (zoom-in only) in the bond region, so they don't appear here.
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

/** Animated electrons flowing along bonds — the "look inside the bond"
 *  view that activates above NUCLEUS_ZOOM_THRESHOLD via the same
 *  bohrFade crossfade used by the nucleus and shells layers.
 *
 *  Covalent bonds get pairs of electrons that loop back and forth between
 *  the two atoms along the bond axis. The two electrons of a pair are
 *  phase-offset by π so one is near A while its partner is near B, then
 *  they swap — making "sharing" of the covalent pair concrete instead
 *  of an abstract claim about flat parallel lines.
 *
 *  Ionic bonds get a single electron traveling one-way from cation to
 *  anion (donor → acceptor), making the *transfer* direction explicit
 *  rather than another oscillation. The donor side is determined by
 *  whichever atomA/atomB in the matching bond rule has a positive
 *  formalChargeDelta (lost an electron). */
function drawBondFlow(
  g: Graphics,
  scene: SceneState,
  elements: Element[],
  bondRules: import("@/types").BondRule[],
  timeSec: number,
  zoom: number,
  reduceMotion: boolean
) {
  g.clear();
  const fade = bohrFade(zoom);
  if (fade <= 0) return;
  g.alpha = fade;

  // Amber palette so the bond electrons read as a different "kind of
  // moving thing" from the white shell electrons inside atoms — keeps
  // "inside-the-atom" and "between-atoms" visually distinct when both
  // layers are on screen at once.
  const ELECTRON_CORE = 0xfde047; // amber-300
  const ELECTRON_HALO = 0xfacc15; // amber-400
  const ELECTRON_OUTLINE = 0x854d0e; // amber-900

  for (const bond of scene.bonds) {
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
    if (dist === 0) continue;
    const visible = dist - rA - rB;
    if (visible < 16) continue;

    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;

    // Travel endpoints sit just outside each atom body so the
    // electrons appear to enter and exit the visible atom rim.
    const startX = atomA.x + ux * rA;
    const startY = atomA.y + uy * rA;
    const endX = atomB.x - ux * rB;
    const endY = atomB.y - uy * rB;

    if (bond.bondType === "ionic") {
      // Donor (positive charge delta = lost an electron) → acceptor.
      // Match the rule by the (atomA, atomB) element pair regardless
      // of order, then read the side whose element matches our atomA.
      const rule = bondRules.find(
        (r) =>
          r.bondType === "ionic" &&
          ((r.atomA === atomA.elementId && r.atomB === atomB.elementId) ||
            (r.atomB === atomA.elementId && r.atomA === atomB.elementId))
      );
      let donorIsA = true;
      if (rule) {
        const aSideCharge =
          rule.atomA === atomA.elementId
            ? rule.formalChargeDeltaA
            : rule.formalChargeDeltaB;
        donorIsA = aSideCharge > 0;
      }

      const period = 1.6;
      const t = reduceMotion ? 0.5 : (timeSec / period) % 1;
      const fromX = donorIsA ? startX : endX;
      const fromY = donorIsA ? startY : endY;
      const toX = donorIsA ? endX : startX;
      const toY = donorIsA ? endY : startY;
      const ex = fromX + (toX - fromX) * t;
      const ey = fromY + (toY - fromY) * t;

      g.circle(ex, ey, 5.5);
      g.fill({ color: ELECTRON_HALO, alpha: 0.42 });
      g.circle(ex, ey, 2.6);
      g.fill({ color: ELECTRON_CORE, alpha: 1 });
      g.stroke({ width: 0.5, color: ELECTRON_OUTLINE, alpha: 0.7 });
      continue;
    }

    // Covalent: pairs of electrons travel along parallel lanes that
    // line up with the parallel strokes drawn in bond-graphics.ts.
    const pairs =
      bond.bondType === "covalent-triple"
        ? 3
        : bond.bondType === "covalent-double"
          ? 2
          : 1;
    const perpSpacing = pairs === 3 ? 7 : pairs === 2 ? 5 : 0;

    const period = 2.0;
    const phaseRate = (Math.PI * 2) / period;

    for (let p = 0; p < pairs; p++) {
      const lane = pairs === 1 ? 0 : p - (pairs - 1) / 2;
      const offX = px * perpSpacing * lane;
      const offY = py * perpSpacing * lane;

      // Stagger pair phase so multi-bond pairs and adjacent bonds
      // don't all pulse in lockstep — the scene reads as alive rather
      // than as a single metronome.
      const phase = reduceMotion ? 0 : timeSec * phaseRate + p * 0.7;

      for (let d = 0; d < 2; d++) {
        const electronPhase = phase + (d === 1 ? Math.PI : 0);
        // Cosine maps [0, 2π] → [1, -1], so t = (1 + cos)/2 ∈ [0, 1]
        // with a smooth pause at each end — the electron lingers near
        // each nucleus before swinging back across the bond.
        const t = reduceMotion ? 0.5 : (1 + Math.cos(electronPhase)) / 2;
        const baseX = startX + (endX - startX) * t;
        const baseY = startY + (endY - startY) * t;
        // Tiny perpendicular wobble at double frequency so it reads
        // as quivering "orbital cloud" rather than a flat slide.
        const wobble = reduceMotion ? 0 : Math.sin(electronPhase * 2) * 1.2;
        const ex = baseX + offX + px * wobble;
        const ey = baseY + offY + py * wobble;

        g.circle(ex, ey, 4.5);
        g.fill({ color: ELECTRON_HALO, alpha: 0.4 });
        g.circle(ex, ey, 2.3);
        g.fill({ color: ELECTRON_CORE, alpha: 1 });
        g.stroke({ width: 0.5, color: ELECTRON_OUTLINE, alpha: 0.7 });
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
  // Bond-flow layer — animated electrons traveling along each bond
  // (covalent: pairs cycling between atoms; ionic: one-way donor→acceptor
  // transfer). Crossfades in via the same bohrFade curve as the nucleus
  // and shell layers, taking over from the simple swinging-dots layer.
  const bondFlowRef = useRef<Graphics | null>(null);
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
  // Multi-pointer gesture state. activePointers maps pointerId →
  // current global coords; gestureMode tells the move handler which
  // gesture to run (one pointer = pan, two pointers = pinch).
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureModeRef = useRef<"none" | "pan" | "pinch">("none");
  const panGestureRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    isMoving: boolean;
  } | null>(null);
  const pinchGestureRef = useRef<{
    startDist: number;
    startZoom: number;
    sceneAnchorX: number;
    sceneAnchorY: number;
  } | null>(null);

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

      // Bond-flow layer — the zoomed-in "look inside the bond" detail.
      // Animated electrons travel along each bond (covalent: pairs
      // looping between atoms; ionic: one-way donor → acceptor) and
      // fade in via bohrFade once the player zooms past
      // NUCLEUS_FADE_START. Sits above bonds and below atoms so the
      // electrons read as moving on the bond surface.
      const bondFlowG = new Graphics();
      bondFlowG.zIndex = 1.55;
      sceneContainer.addChild(bondFlowG);
      bondFlowRef.current = bondFlowG;

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

        // Bond-flow electrons — the zoom-in "look inside the bond"
        // animation. Empty at normal zoom; fades in via bohrFade once
        // the player zooms past NUCLEUS_FADE_START.
        if (bondFlowRef.current) {
          drawBondFlow(
            bondFlowRef.current,
            scene,
            content.elements,
            content.bondRules,
            tSec,
            zoomRef.current,
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
            content.bondRules,
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

      // Unified background gesture handling: one finger = pan, two
      // fingers = pinch zoom (or wheel zoom on desktop). A single
      // pointer that didn't move beyond the 5px threshold is treated
      // as a tap and clears selection. Pointer state is kept on
      // component refs so the move/up handlers attached at init can
      // see the current gesture mode without per-event closures.
      const startPan = (globalX: number, globalY: number) => {
        panGestureRef.current = {
          startX: globalX,
          startY: globalY,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
          isMoving: false,
        };
      };
      const updatePan = (globalX: number, globalY: number) => {
        const s = panGestureRef.current;
        if (!s) return;
        const dx = globalX - s.startX;
        const dy = globalY - s.startY;
        if (!s.isMoving && Math.sqrt(dx * dx + dy * dy) > 5) {
          s.isMoving = true;
          pixiCanvas.style.cursor = "grabbing";
        }
        if (s.isMoving) {
          panRef.current.x = s.startPanX + dx;
          panRef.current.y = s.startPanY + dy;
          sceneContainer.x = panRef.current.x;
          sceneContainer.y = panRef.current.y;
        }
      };
      const endPan = (treatAsTap: boolean) => {
        const s = panGestureRef.current;
        pixiCanvas.style.cursor = "";
        panGestureRef.current = null;
        if (treatAsTap && s && !s.isMoving) {
          const state = useGameStore.getState();
          if (state.selectedBondId) setSelectedBond(null);
          if (state.selectedAtomId) setSelectedAtom(null);
          dismissContextMenu();
        }
      };

      const pointerPair = () => Array.from(activePointersRef.current.values());
      const startPinch = () => {
        const [a, b] = pointerPair();
        if (!a || !b) return;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        // Scene-local anchor under the pinch midpoint at gesture
        // start. The midpoint of the two fingers stays fixed while
        // the player pinches — same anchoring trick the wheel zoom
        // uses for the cursor.
        const sceneAnchorX = (midX - panRef.current.x) / zoomRef.current;
        const sceneAnchorY = (midY - panRef.current.y) / zoomRef.current;
        pinchGestureRef.current = {
          startDist: dist,
          startZoom: zoomRef.current,
          sceneAnchorX,
          sceneAnchorY,
        };
      };
      const updatePinch = () => {
        const s = pinchGestureRef.current;
        if (!s) return;
        const [a, b] = pointerPair();
        if (!a || !b) return;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const ratio = dist / s.startDist;
        const newZoom = Math.max(0.5, Math.min(3, s.startZoom * ratio));
        const oldZoom = zoomRef.current;
        zoomRef.current = newZoom;
        sceneContainer.scale.set(newZoom);
        // Re-anchor pan so the scene point captured at pinch start
        // stays under the current finger midpoint.
        panRef.current.x = midX - s.sceneAnchorX * newZoom;
        panRef.current.y = midY - s.sceneAnchorY * newZoom;
        sceneContainer.x = panRef.current.x;
        sceneContainer.y = panRef.current.y;

        // Anywhere inside the fade window (or crossing it), redraw
        // both Bohr layers so their alpha follows the new zoom. The
        // electrons Ticker also continuously redraws shells, but
        // nucleiG only redraws when this handler fires or when the
        // scene changes — so it needs the explicit refresh here.
        const inFade =
          newZoom >= NUCLEUS_FADE_START || oldZoom >= NUCLEUS_FADE_START;
        if (inFade) {
          const scene = useGameStore.getState().scene;
          const reduceMotion =
            useProgressStore.getState().settings?.reducedMotion ?? false;
          const tSec = performance.now() / 1000;
          if (nucleiRef.current) {
            drawNuclei(nucleiRef.current, scene, content.elements, newZoom);
          }
          if (electronShellsRef.current) {
            drawElectronShells(
              electronShellsRef.current,
              scene,
              content.elements,
              content.bondRules,
              tSec,
              newZoom,
              reduceMotion
            );
          }
          // Bond-flow layer also crossfades through this window —
          // refresh so the alpha tracks pinch motion smoothly
          // between ticker frames.
          if (bondFlowRef.current) {
            drawBondFlow(
              bondFlowRef.current,
              scene,
              content.elements,
              content.bondRules,
              tSec,
              newZoom,
              reduceMotion
            );
          }
        }
      };
      const endPinch = () => {
        pinchGestureRef.current = null;
      };

      app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
        if (e.target !== app.stage) return;
        activePointersRef.current.set(e.pointerId, {
          x: e.globalX,
          y: e.globalY,
        });
        const count = activePointersRef.current.size;

        if (count === 1) {
          gestureModeRef.current = "pan";
          startPan(e.globalX, e.globalY);
        } else if (count === 2) {
          // Second finger arrived mid-pan: silently end the pan
          // (don't fire its tap-to-deselect) and start pinching.
          if (gestureModeRef.current === "pan") endPan(false);
          gestureModeRef.current = "pinch";
          startPinch();
        }
        // 3+ pointers: ignored. Already-tracked pointers continue.
      });

      app.stage.on(
        "globalpointermove",
        (e: FederatedPointerEvent) => {
          if (!activePointersRef.current.has(e.pointerId)) return;
          activePointersRef.current.set(e.pointerId, {
            x: e.globalX,
            y: e.globalY,
          });
          if (gestureModeRef.current === "pan") {
            updatePan(e.globalX, e.globalY);
          } else if (gestureModeRef.current === "pinch") {
            updatePinch();
          }
        }
      );

      const handlePointerEnd = (e: FederatedPointerEvent) => {
        if (!activePointersRef.current.has(e.pointerId)) return;
        activePointersRef.current.delete(e.pointerId);
        const remaining = activePointersRef.current.size;

        if (gestureModeRef.current === "pinch") {
          endPinch();
          if (remaining === 1) {
            // Demote back to pan with the surviving pointer so the
            // user can keep dragging without lifting the second finger.
            gestureModeRef.current = "pan";
            const last = pointerPair()[0];
            startPan(last.x, last.y);
          } else {
            gestureModeRef.current = "none";
          }
        } else if (gestureModeRef.current === "pan" && remaining === 0) {
          endPan(true);
          gestureModeRef.current = "none";
        }
      };
      app.stage.on("pointerup", handlePointerEnd);
      app.stage.on("pointerupoutside", handlePointerEnd);
      app.stage.on("pointercancel", handlePointerEnd);

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

          // Nucleus + shell + bond-flow visibility is zoom-gated —
          // redraw whenever the crossing happens (and on the way out
          // too, so the layers clear when zooming back below threshold).
          const scene = useGameStore.getState().scene;
          const reduceMotion =
            useProgressStore.getState().settings?.reducedMotion ?? false;
          const tSec = performance.now() / 1000;
          if (nucleiRef.current) {
            drawNuclei(
              nucleiRef.current,
              scene,
              content.elements,
              newZoom
            );
          }
          if (electronShellsRef.current) {
            drawElectronShells(
              electronShellsRef.current,
              scene,
              content.elements,
              content.bondRules,
              tSec,
              newZoom,
              reduceMotion
            );
          }
          if (bondFlowRef.current) {
            drawBondFlow(
              bondFlowRef.current,
              scene,
              content.elements,
              content.bondRules,
              tSec,
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
      valenceRef.current = null;
      chargesRef.current = null;
      nucleiRef.current = null;
      electronShellsRef.current = null;
      bondFlowRef.current = null;
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
        // Rule-driven bond selection. validateBond reports invalid for
        // both "no rule exists for this pair" and "rule exists but
        // valence is exhausted" — both should refuse the bond and
        // surface a chemistry-correct explanation. Earlier this path
        // permissively fell back to covalent-single when no rule
        // existed, which let the player create silent chemistry-wrong
        // bonds (e.g. H-Na in the Ionic vs Covalent mission). Trust
        // validateBond instead — content authoring is responsible for
        // listing the chemistry that should bond, full stop.
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
          state.showFeedback(result.explanation, "error");
          window.dispatchEvent(new CustomEvent("sparklab-invalid-action"));
          setSelectedAtom(atomId);
          return;
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

