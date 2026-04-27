"use client";

import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text, FederatedPointerEvent } from "pixi.js";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import type { Element } from "@/types";
import { getElementBySymbol } from "@/data/loader";
import type { ContentBundle } from "@/data/loader";
import { shakeSprite, createTooltip } from "./effects";
import {
  createAtomSprite,
  updateAtomSprite,
  ATOM_RADIUS,
  parseColorToken,
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

      const atomsContainer = new Container();
      atomsContainer.zIndex = 2;
      sceneContainer.addChild(atomsContainer);
      atomsContainerRef.current = atomsContainer;

      const effectsContainer = new Container();
      effectsContainer.zIndex = 3;
      sceneContainer.addChild(effectsContainer);
      effectsContainerRef.current = effectsContainer;

      // Enable interactivity
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      // Background click/tap: clear selection. Atoms move only via drag
      // (handleAtomPointerDown) or keyboard arrows (in game/page.tsx).
      // Click-to-move was a misclick trap — players who wanted to
      // deselect ended up teleporting the selected atom across the
      // canvas.
      app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
        if (e.target === app.stage) {
          const state = useGameStore.getState();
          if (state.selectedBondId) setSelectedBond(null);
          if (state.selectedAtomId) setSelectedAtom(null);
          dismissContextMenu();
        }
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

      // Zoom with mouse wheel
      pixiCanvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const zoomSpeed = 0.001;
        zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current - e.deltaY * zoomSpeed));
        sceneContainer.scale.set(zoomRef.current);
        sceneContainer.x = panRef.current.x;
        sceneContainer.y = panRef.current.y;
      }, { passive: false });
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
          onHover: handleAtomHover,
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
      // Look up element colors so the bond inner stroke can gradient
      // between the two endpoints' atom palettes — H-O reads as
      // blue→red, etc. Falls back to neutral slate inside drawBond if
      // either lookup fails.
      const elementA = getElementBySymbol(content.elements, atomA.elementId);
      const elementB = getElementBySymbol(content.elements, atomB.elementId);
      const colorA = elementA ? parseColorToken(elementA.colorToken) : undefined;
      const colorB = elementB ? parseColorToken(elementB.colorToken) : undefined;
      drawBond(
        g,
        atomA,
        atomB,
        bond.bondType,
        selectedBondId === bond.id,
        colorA,
        colorB
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
  }, [scene, selectedAtomId, selectedBondId, content.elements, settings]);

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

    // Pull the line endpoints into the atoms by ATOM_RADIUS so the
    // dashes don't crash through the colored circles.
    const dx = endX - sourceAtom.x;
    const dy = endY - sourceAtom.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > ATOM_RADIUS + 4) {
      const ux = dx / dist;
      const uy = dy / dist;
      const startX = sourceAtom.x + ux * ATOM_RADIUS;
      const startY = sourceAtom.y + uy * ATOM_RADIUS;
      // When snapping, end before the target atom; otherwise stop at
      // the cursor itself.
      const stopShort = snapTarget ? ATOM_RADIUS : 0;
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
      g.circle(snapTarget.x, snapTarget.y, ATOM_RADIUS + 6);
      g.stroke({ width: 3, color: BOND_PREVIEW_COLOR, alpha: 0.85 });
      g.circle(snapTarget.x, snapTarget.y, ATOM_RADIUS + 11);
      g.stroke({ width: 2, color: BOND_PREVIEW_COLOR, alpha: 0.35 });
    }
    // No move cue any more — clicking empty canvas clears the selection,
    // it doesn't relocate the atom (atoms move only via drag).
  }

  function handleAtomHover(
    _e: FederatedPointerEvent,
    atomId: string,
    element: Element
  ) {
    // Suppress tooltips while a drag is in progress so labels don't pop up
    // on every atom the cursor sweeps past.
    if (draggingRef.current) return;
    const effectsContainer = effectsContainerRef.current;
    if (!effectsContainer) return;
    const sprite = atomSpritesRef.current.get(atomId);
    if (!sprite) return;
    const pos = sprite.getGlobalPosition();
    createTooltip(effectsContainer, pos.x, pos.y, `${element.name} (${element.atomicNumber})`);
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

