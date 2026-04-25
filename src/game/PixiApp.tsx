"use client";

import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text, FederatedPointerEvent } from "pixi.js";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import type { Element } from "@/types";
import { getElementBySymbol } from "@/data/loader";
import type { ContentBundle } from "@/data/loader";
import { shakeSprite, createTooltip } from "./effects";
import { createAtomSprite, updateAtomSprite } from "./atom-sprite";
import { drawBond } from "./bond-graphics";
import { animateScale } from "./animations";

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

      // Background click/tap: move selected atom or clear selection
      app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
        if (e.target === app.stage) {
          const state = useGameStore.getState();
          if (state.selectedAtomId) {
            // Tap-to-move: move selected atom to tapped location
            const localPos = sceneContainer.toLocal({ x: e.globalX, y: e.globalY });
            moveAtom(state.selectedAtomId, localPos.x, localPos.y);
          } else if (state.selectedBondId) {
            setSelectedBond(null);
          } else {
            setSelectedAtom(null);
          }
          // Dismiss context menu
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
      if (!g) {
        g = new Graphics();
        g.eventMode = "static";
        g.cursor = "pointer";
        const bondId = bond.id;
        g.on("pointerdown", (e: FederatedPointerEvent) => handleBondPointerDown(e, bondId));
        bondsContainer.addChild(g);
        bondGraphicsRef.current.set(bond.id, g);
      }
      drawBond(g, atomA, atomB, bond.bondType, selectedBondId === bond.id);
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
    setSelectedBond(bondId);
    showContextMenu(e.globalX, e.globalY - 12, "Delete bond", () => removeBond(bondId));
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
      // Bond previously-selected atom to the just-tapped atom.
      const bond = {
        id: crypto.randomUUID(),
        atomAId: previouslySelectedId,
        atomBId: atomId,
        bondType: "covalent-single" as const,
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

    // Check if hovering over another atom
    let hoveringAtom = false;
    for (const atom of state.scene.atoms) {
      if (atom.id === selectedId) continue;
      const dx = atom.x - localPos.x;
      const dy = atom.y - localPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 40) {
        hoveringAtom = true;
        break;
      }
    }

    if (!hoverCueRef.current) {
      hoverCueRef.current = new Graphics();
      effectsContainer.addChild(hoverCueRef.current);
    }

    const g = hoverCueRef.current;
    g.clear();

    if (hoveringAtom) {
      // Bond cue: ring around cursor
      g.circle(localPos.x, localPos.y, 20);
      g.stroke({ width: 2, color: 0x22c55e, alpha: 0.6 });
    } else {
      // Move cue: crosshair
      g.moveTo(localPos.x - 12, localPos.y);
      g.lineTo(localPos.x + 12, localPos.y);
      g.moveTo(localPos.x, localPos.y - 12);
      g.lineTo(localPos.x, localPos.y + 12);
      g.circle(localPos.x, localPos.y, 16);
      g.stroke({ width: 2, color: 0x3b82f6, alpha: 0.4 });
    }
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

  return (
    <div
      ref={containerRef}
      className="w-full h-full block relative"
      style={{ touchAction: "none", userSelect: "none" }}
    />
  );
}

