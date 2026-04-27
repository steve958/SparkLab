"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/store/gameStore";
import type { Element } from "@/types";
import { CheckCircle, AlertCircle } from "lucide-react";

interface AtomLedgerProps {
  elements: Element[];
  centerX?: number;
}

export default function AtomLedger({ elements, centerX = 400 }: AtomLedgerProps) {
  const { t } = useTranslation();
  const scene = useGameStore((s) => s.scene);
  const reactionMode = useGameStore((s) => s.reactionMode);

  // Prefer the side stamped on the atom at spawn (set by the
  // Reactants/Products tray buttons) — that's the player's stated
  // intent and survives drags, pan, zoom, and viewport changes. Fall
  // back to the legacy x-vs-centerX partition only for atoms without a
  // stamped side (older saves, or atoms placed before the side-aware
  // tray landed).
  const reactantAtoms = useMemo(
    () =>
      scene.atoms.filter((a) =>
        a.side ? a.side === "reactants" : a.x < centerX
      ),
    [scene.atoms, centerX]
  );
  const productAtoms = useMemo(
    () =>
      scene.atoms.filter((a) =>
        a.side ? a.side === "products" : a.x >= centerX
      ),
    [scene.atoms, centerX]
  );

  const reactantCounts = useMemo(() => countByElement(reactantAtoms), [reactantAtoms]);
  const productCounts = useMemo(() => countByElement(productAtoms), [productAtoms]);

  // All elements that appear on either side
  const allElements = useMemo(() => {
    const set = new Set<string>();
    for (const el of Object.keys(reactantCounts)) set.add(el);
    for (const el of Object.keys(productCounts)) set.add(el);
    return Array.from(set).sort();
  }, [reactantCounts, productCounts]);

  const isConserved = useMemo(() => {
    for (const el of allElements) {
      if ((reactantCounts[el] || 0) !== (productCounts[el] || 0)) {
        return false;
      }
    }
    return reactantAtoms.length > 0 && productAtoms.length > 0;
  }, [reactantCounts, productCounts, allElements, reactantAtoms.length, productAtoms.length]);

  if (!reactionMode) return null;
  if (scene.atoms.length === 0) return null;

  return (
    <div className="px-2 sm:px-3 py-2 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-0 flex-1">
          <span className="flex-1 text-center truncate">{t("game.reactants")}</span>
          <span className="w-6 sm:w-8 shrink-0" />
          <span className="flex-1 text-center truncate">{t("game.products")}</span>
        </div>
        <div
          className={`flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
            isConserved
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {isConserved ? (
            <>
              <CheckCircle className="w-3 h-3" />
              <span className="hidden xs:inline sm:inline">{t("game.conserved")}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" />
              <span className="hidden xs:inline sm:inline">{t("game.not_conserved")}</span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {allElements.map((symbol) => {
          const element = elements.find((e) => e.symbol === symbol);
          const reactantCount = reactantCounts[symbol] || 0;
          const productCount = productCounts[symbol] || 0;
          const balanced = reactantCount === productCount && reactantCount > 0;

          return (
            <div key={symbol} className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: element?.colorToken || "#94a3b8" }}
              >
                {symbol}
              </div>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span
                  className={`flex-1 text-center text-sm font-mono font-semibold ${
                    reactantCount === 0 ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  {reactantCount}
                </span>
                <span
                  className={`w-6 sm:w-8 text-center text-sm shrink-0 ${
                    balanced ? "text-green-500" : "text-red-400"
                  }`}
                >
                  {balanced ? "=" : "≠"}
                </span>
                <span
                  className={`flex-1 text-center text-sm font-mono font-semibold ${
                    productCount === 0 ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  {productCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function countByElement(atoms: { elementId: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const atom of atoms) {
    counts[atom.elementId] = (counts[atom.elementId] || 0) + 1;
  }
  return counts;
}
