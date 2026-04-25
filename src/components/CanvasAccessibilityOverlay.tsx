"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { getElementBySymbol } from "@/data/loader";
import type { ContentBundle } from "@/data/loader";

interface CanvasAccessibilityOverlayProps {
  content: ContentBundle;
}

export default function CanvasAccessibilityOverlay({
  content,
}: CanvasAccessibilityOverlayProps) {
  const scene = useGameStore((s) => s.scene);
  const selectedAtomId = useGameStore((s) => s.selectedAtomId);
  const setSelectedAtom = useGameStore((s) => s.setSelectedAtom);
  const moveAtom = useGameStore((s) => s.moveAtom);
  const removeAtom = useGameStore((s) => s.removeAtom);
  const addBond = useGameStore((s) => s.addBond);

  const listRef = useRef<HTMLUListElement>(null);

  // Announce scene changes to screen readers
  useEffect(() => {
    const liveRegion = document.getElementById("scene-live-region");
    if (liveRegion) {
      liveRegion.textContent = `Scene has ${scene.atoms.length} atoms and ${scene.bonds.length} bonds.`;
    }
  }, [scene.atoms.length, scene.bonds.length]);

  const handleNudge = useCallback(
    (atomId: string, dx: number, dy: number) => {
      const atom = scene.atoms.find((a) => a.id === atomId);
      if (!atom) return;
      moveAtom(atomId, atom.x + dx, atom.y + dy);
    },
    [scene.atoms, moveAtom]
  );

  const handleBondNearest = useCallback(
    (atomId: string) => {
      const selectedAtom = scene.atoms.find((a) => a.id === atomId);
      if (!selectedAtom) return;

      let nearest: { id: string; x: number; y: number } | null = null;
      let nearestDist = Infinity;
      for (const atom of scene.atoms) {
        if (atom.id === atomId) continue;
        const dx = atom.x - selectedAtom.x;
        const dy = atom.y - selectedAtom.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist && dist < 150) {
          nearestDist = dist;
          nearest = atom;
        }
      }

      if (nearest) {
        addBond({
          id: crypto.randomUUID(),
          atomAId: atomId,
          atomBId: nearest.id,
          bondType: "covalent-single",
        });
      }
    },
    [scene.atoms, addBond]
  );

  if (scene.atoms.length === 0) return null;

  return (
    <div className="absolute top-2 left-2 z-10 max-h-[60%] overflow-y-auto">
      <ul
        ref={listRef}
        className="sr-only focus-within:not-sr-only bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg p-2 min-w-[200px]"
        aria-label="Atom navigation. Use Tab to move between atoms, arrow keys to move the selected atom, Enter to bond to nearest, Delete to remove."
      >
        <li className="text-xs font-semibold text-slate-500 px-2 py-1 mb-1 uppercase tracking-wide">
          Atoms ({scene.atoms.length})
        </li>
        {scene.atoms.map((atom) => {
          const element = getElementBySymbol(content.elements, atom.elementId);
          const isSelected = selectedAtomId === atom.id;
          const bondCount = scene.bonds.filter(
            (b) => b.atomAId === atom.id || b.atomBId === atom.id
          ).length;

          return (
            <li key={atom.id}>
              <button
                onFocus={() => setSelectedAtom(atom.id)}
                onClick={() => setSelectedAtom(atom.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    handleNudge(atom.id, 0, -10);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    handleNudge(atom.id, 0, 10);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    handleNudge(atom.id, -10, 0);
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    handleNudge(atom.id, 10, 0);
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBondNearest(atom.id);
                  } else if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    removeAtom(atom.id);
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                  isSelected
                    ? "bg-sky-100 text-sky-800 ring-1 ring-sky-300"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
                aria-label={`${element?.name ?? atom.elementId} atom. Position ${Math.round(
                  atom.x
                )}, ${Math.round(atom.y)}. ${bondCount} bonds.`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: element?.colorToken || "#94a3b8",
                    }}
                  />
                  <span className="font-medium">
                    {element?.name ?? atom.elementId}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {bondCount} bond{bondCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 pl-5">
                  x:{Math.round(atom.x)} y:{Math.round(atom.y)}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
