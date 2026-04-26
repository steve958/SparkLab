"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import { loadContent, type ContentBundle } from "@/data/loader";
import { validateSceneMolecule } from "@/engine/molecule";
import { goBackOr } from "@/lib/navigation";
import CanvasAccessibilityOverlay from "@/components/CanvasAccessibilityOverlay";
import { ArrowLeft, Beaker, Save, RotateCcw, X } from "lucide-react";

const PixiApp = dynamic(() => import("@/game/PixiApp"), { ssr: false });

// Sandbox — free play mode. All elements available; no mission, no
// success conditions. Players experiment and "Save" writes a Discovery
// when the structure matches a known molecule.
//
// Element unlock model: per Phase 2 default decision, all elements are
// available immediately so sandbox feels like exploration, not homework.
export default function SandboxPage() {
  const router = useRouter();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const addDiscoveryRecord = useProgressStore((s) => s.addDiscoveryRecord);

  const scene = useGameStore((s) => s.scene);
  const resetScene = useGameStore((s) => s.resetScene);
  const initMission = useGameStore((s) => s.initMission);
  const addAtom = useGameStore((s) => s.addAtom);

  const [content, setContent] = useState<ContentBundle | null>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: "success" | "info";
  } | null>(null);

  // Mount: clear the scene + load content. We init a synthetic "sandbox"
  // mission so the existing gameStore flow (undo, selection, hints) keeps
  // working in a sane initial state.
  useEffect(() => {
    if (!currentProfile) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    loadContent().then((bundle) => {
      if (cancelled) return;
      setContent(bundle);
      initMission({
        missionId: "sandbox",
        worldId: "sandbox",
        title: "Sandbox",
        brief: "Free play",
        objectiveType: "build-molecule",
        allowedElements: bundle.elements.map((e) => e.symbol),
        allowedMolecules: bundle.molecules.map((m) => m.moleculeId),
        successConditions: [],
        hintSetId: "",
        estimatedMinutes: 0,
        standardsTags: [],
        teacherNotes: "",
        difficulty: 1,
        ageBand: currentProfile.ageBand,
        prerequisites: [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [currentProfile, router, initMission]);

  const handleSave = useCallback(async () => {
    if (!content || !currentProfile) return;
    if (scene.atoms.length === 0) {
      setFeedback({
        text: "Your bench is empty — try adding some atoms first.",
        tone: "info",
      });
      return;
    }
    const result = validateSceneMolecule(
      content.molecules,
      scene.atoms,
      scene.bonds
    );
    if (result.matches && result.matchedMoleculeId) {
      const molecule = content.molecules.find(
        (m) => m.moleculeId === result.matchedMoleculeId
      );
      const recorded = await addDiscoveryRecord({
        profileId: currentProfile.id,
        kind: "sandbox-molecule",
        refId: result.matchedMoleculeId,
        label: molecule?.displayName ?? result.matchedMoleculeId,
        explanation: result.explanation,
      });
      setFeedback({
        text: recorded
          ? `Saved ${molecule?.displayName ?? "your creation"} to the notebook!`
          : `Already in your notebook — try something new.`,
        tone: "success",
      });
    } else {
      setFeedback({
        text: "We don't recognize this molecule yet — keep experimenting!",
        tone: "info",
      });
    }
  }, [content, currentProfile, scene, addDiscoveryRecord]);

  if (!currentProfile || !content) return null;

  return (
    <main className="flex-1 flex flex-col h-[100svh] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 bg-white border-b border-slate-200">
        <button
          onClick={() => goBackOr(router, "/")}
          className="p-2 rounded-lg hover:bg-slate-100 touch-target shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Beaker className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-semibold text-sm sm:text-base truncate">
            Sandbox
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => resetScene()}
            className="p-2 rounded-lg hover:bg-slate-100 touch-target"
            aria-label="Clear scene"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Atom tray — every element available */}
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto">
        <span className="text-xs font-medium text-slate-600 shrink-0 mr-1">
          Atoms:
        </span>
        {content.elements
          .slice()
          .sort((a, b) => a.atomicNumber - b.atomicNumber)
          .map((element) => (
            <button
              key={element.symbol}
              onClick={() => {
                const canvas = document.querySelector("canvas");
                const rect = canvas?.getBoundingClientRect();
                const x =
                  (rect ? rect.width / 2 : 400) +
                  (Math.random() - 0.5) * 100;
                const y =
                  (rect ? rect.height / 2 : 300) +
                  (Math.random() - 0.5) * 100;
                addAtom({
                  id: crypto.randomUUID(),
                  elementId: element.symbol,
                  x,
                  y,
                  protons: element.atomicNumber,
                  neutrons: 0,
                  electrons: element.atomicNumber,
                });
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-primary hover:bg-sky-50 transition-colors shrink-0 touch-target"
              aria-label={`Add ${element.name} atom`}
            >
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: element.colorToken }}
              />
              <span className="font-bold text-sm">{element.symbol}</span>
            </button>
          ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative game-canvas-container min-h-0">
        <PixiApp content={content} />
        <CanvasAccessibilityOverlay content={content} />

        {feedback && (
          <div
            className={`absolute top-3 left-1/2 -translate-x-1/2 max-w-md w-[90%] px-4 py-3 rounded-xl shadow-lg z-10 text-white font-medium text-sm flex items-center gap-2 ${
              feedback.tone === "success" ? "bg-success" : "bg-primary"
            }`}
          >
            <span className="flex-1">{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="p-1 rounded hover:bg-white/20"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-end gap-2 p-2 sm:p-3 bg-white border-t border-slate-200">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors touch-target-lg"
        >
          <Save className="w-5 h-5" />
          Save creation
        </button>
      </div>
    </main>
  );
}
