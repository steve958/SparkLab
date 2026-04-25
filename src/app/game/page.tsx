"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { loadContent, clearContentCache, type ContentBundle, getString } from "@/data/loader";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import { saveSlot, saveMissionProgress } from "@/lib/db";
import { validateSceneMolecule } from "@/engine/molecule";
import { validateReactionMission } from "@/engine/reaction";
import { validateBond } from "@/engine/bond";
import { nudgePosition, findNearestAtom } from "@/engine/interaction";
import { calculateScore } from "@/engine/scoring";
import GameHUD from "@/components/GameHUD";
import CanvasAccessibilityOverlay from "@/components/CanvasAccessibilityOverlay";
import ExplanationQuizModal from "@/components/ExplanationQuizModal";
import type { ExplanationQuiz, SceneAtom, SceneBond } from "@/types";

const PixiApp = dynamic(() => import("@/game/PixiApp"), { ssr: false });

export default function GamePage() {
  const router = useRouter();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const updateProgress = useProgressStore((s) => s.updateProgress);

  const mission = useGameStore((s) => s.currentMission);
  const scene = useGameStore((s) => s.scene);
  const scoreState = useGameStore((s) => s.scoreState);
  const hintState = useGameStore((s) => s.hintState);
  const reactionMode = useGameStore((s) => s.reactionMode);
  const initMission = useGameStore((s) => s.initMission);
  const addAtom = useGameStore((s) => s.addAtom);
  const addBond = useGameStore((s) => s.addBond);
  const removeAtom = useGameStore((s) => s.removeAtom);
  const moveAtom = useGameStore((s) => s.moveAtom);
  const setSelectedAtom = useGameStore((s) => s.setSelectedAtom);
  const showFeedback = useGameStore((s) => s.showFeedback);
  const completeMission = useGameStore((s) => s.completeMission);

  const [content, setContent] = useState<ContentBundle | null>(null);
  const [contentError, setContentError] = useState<Error | null>(null);
  const [contentReloadKey, setContentReloadKey] = useState(0);
  const [pendingQuiz, setPendingQuiz] = useState<{
    quiz: ExplanationQuiz;
    explanationText: string;
  } | null>(null);

  const finalizeMission = useCallback(
    async (explanationCorrect: boolean | null, explanationText: string) => {
      if (!mission) return;
      const calc = calculateScore(
        true,
        hintState.hintsUsed,
        explanationCorrect,
        scoreState.attempts + 1
      );
      completeMission(calc.stars, explanationCorrect);

      if (currentProfile) {
        const progressRecord = {
          profileId: currentProfile.id,
          missionId: mission.missionId,
          stars: calc.stars,
          completedAt: Date.now(),
          attempts: scoreState.attempts + 1,
          bestIndependenceScore: calc.independenceScore,
        };
        await saveMissionProgress(progressRecord);
        await updateProgress(progressRecord);
      }

      showFeedback(explanationText, "success");
    },
    [
      mission,
      hintState,
      scoreState,
      currentProfile,
      completeMission,
      showFeedback,
      updateProgress,
    ]
  );

  const handleSuccess = useCallback(
    async (explanationText: string) => {
      if (mission?.explanationQuiz) {
        setPendingQuiz({ quiz: mission.explanationQuiz, explanationText });
      } else {
        await finalizeMission(null, explanationText);
      }
    },
    [mission, finalizeMission]
  );

  const checkMission = useCallback(async () => {
    if (!mission || !content) return;

    if (mission.objectiveType === "build-molecule") {
      const result = validateSceneMolecule(content.molecules, scene.atoms, scene.bonds);
      if (result.matches) {
        const targetMoleculeId = mission.allowedMolecules[0];
        const molecule = content.molecules.find((m) => m.moleculeId === targetMoleculeId);
        const explanation = molecule
          ? getString(content.strings, `explanation_${molecule.moleculeId}`, "en")
          : "Great job!";
        await handleSuccess(explanation);
      } else {
        showFeedback(result.explanation, "error");
      }
    } else if (mission.objectiveType === "build-atom") {
      const condition = mission.successConditions[0];
      if (condition?.type === "build-atom") {
        const atoms = scene.atoms.filter(
          (a) => a.elementId === condition.targetElement
        );
        if (atoms.length >= 1) {
          await handleSuccess("You built the atom correctly!");
        } else {
          showFeedback("Build an atom with the right number of particles.", "error");
        }
      }
    } else if (mission.objectiveType === "run-reaction") {
      const condition = mission.successConditions[0];
      if (condition?.type === "run-reaction") {
        const reaction = content.reactions.find(
          (r) => r.reactionId === condition.targetReactionId
        );
        if (!reaction) {
          showFeedback("Reaction not found in content.", "error");
          return;
        }

        const canvas = document.querySelector("canvas");
        const rect = canvas?.getBoundingClientRect();
        const centerX = rect ? rect.width / 2 : 400;

        const result = validateReactionMission(
          reaction,
          content.molecules,
          scene.atoms,
          scene.bonds,
          centerX
        );

        if (result.success) {
          const explanation = getString(
            content.strings,
            `explanation_${reaction.reactionId}`,
            "en"
          ) || result.explanation;
          await handleSuccess(explanation);
        } else {
          showFeedback(result.explanation, "error");
        }
      }
    } else {
      showFeedback("Checking...", "info");
    }
  }, [mission, content, scene, handleSuccess, showFeedback]);

  useEffect(() => {
    if (!currentProfile) {
      router.push("/");
      return;
    }
    let cancelled = false;
    setContentError(null);
    loadContent()
      .then((bundle) => {
        if (!cancelled) setContent(bundle);
      })
      .catch((err) => {
        console.error("Failed to load content:", err);
        if (!cancelled) setContentError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [currentProfile, router, contentReloadKey]);

  const retryContentLoad = useCallback(() => {
    clearContentCache();
    setContent(null);
    setContentError(null);
    setContentReloadKey((k) => k + 1);
  }, []);

  // Handle check mission event from HUD
  useEffect(() => {
    const handler = () => {
      if (!mission || !content) return;
      checkMission().catch(console.error);
    };
    window.addEventListener("sparklab-check-mission", handler);
    return () => window.removeEventListener("sparklab-check-mission", handler);
  }, [mission, content, scene, checkMission]);

  // Handle add atom event from HUD
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { elementId: string };
      if (!detail?.elementId) return;

      const canvas = document.querySelector("canvas");
      const rect = canvas?.getBoundingClientRect();
      const state = useGameStore.getState();
      const isReaction = state.reactionMode;
      const x = rect
        ? (isReaction ? rect.width / 4 : rect.width / 2) + (Math.random() - 0.5) * 100
        : (isReaction ? 200 : 400);
      const y = rect ? rect.height / 2 + (Math.random() - 0.5) * 100 : 300;

      const atom: SceneAtom = {
        id: crypto.randomUUID(),
        elementId: detail.elementId,
        x,
        y,
        protons:
          content?.elements.find((e) => e.symbol === detail.elementId)
            ?.atomicNumber ?? 1,
        neutrons: 0,
        electrons:
          content?.elements.find((e) => e.symbol === detail.elementId)
            ?.atomicNumber ?? 1,
      };
      addAtom(atom);
    };
    window.addEventListener("sparklab-add-atom", handler as EventListener);
    return () =>
      window.removeEventListener("sparklab-add-atom", handler as EventListener);
  }, [addAtom, content]);

  // Autosave
  useEffect(() => {
    if (!currentProfile || !mission) return;
    const timer = setTimeout(() => {
      saveSlot({
        profileId: currentProfile.id,
        missionId: mission.missionId,
        sceneState: scene,
        undoStack: [],
        redoStack: [],
        timestamp: Date.now(),
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [scene, currentProfile, mission]);

  // Keyboard accessibility: full canvas control
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const state = useGameStore.getState();
      const selectedId = state.selectedAtomId;

      // Arrow keys: nudge selected atom
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!selectedId) return;
        e.preventDefault();
        const atom = state.scene.atoms.find((a) => a.id === selectedId);
        if (!atom) return;
        const pos = nudgePosition(atom.x, atom.y, e.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", 10);
        moveAtom(selectedId, pos.x, pos.y);
        return;
      }

      // Delete / Backspace: remove the currently selected atom or bond
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          removeAtom(selectedId);
          return;
        }
        const selectedBond = state.selectedBondId;
        if (selectedBond) {
          e.preventDefault();
          useGameStore.getState().removeBond(selectedBond);
          return;
        }
      }

      // Escape: clear all selection
      if (e.key === "Escape") {
        setSelectedAtom(null);
        useGameStore.getState().setSelectedBond(null);
        return;
      }

      // Enter / Space: bond to nearest atom
      if (e.key === "Enter" || e.key === " ") {
        if (!selectedId) return;
        e.preventDefault();

        const selectedAtom = state.scene.atoms.find((a) => a.id === selectedId);
        if (!selectedAtom) return;

        const nearest = findNearestAtom(selectedAtom, state.scene.atoms, 150);

        if (nearest) {
          const bond: SceneBond = {
            id: crypto.randomUUID(),
            atomAId: selectedId,
            atomBId: nearest.id,
            bondType: "covalent-single",
          };
          addBond(bond);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addBond, moveAtom, removeAtom, setSelectedAtom]);

  if (!currentProfile) return null;
  if (contentError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-slate-700 font-semibold mb-1">Couldn&apos;t load chemistry content.</p>
        <p className="text-sm text-slate-500 mb-4 max-w-md text-center">
          {contentError.message}
        </p>
        <div className="flex gap-2">
          <button
            onClick={retryContentLoad}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            Retry
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-slate-500">No mission selected.</p>
        <button
          onClick={() => router.push("/worlds")}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
        >
          Choose a Mission
        </button>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-[100svh] overflow-hidden">
      {content && <GameHUD content={content} />}
      <div className="flex-1 relative game-canvas-container min-h-0">
        {content && <PixiApp content={content} />}
        {content && <CanvasAccessibilityOverlay content={content} />}

        {/* Reaction mode zone overlay */}
        {reactionMode && (
          <div className="absolute inset-0 pointer-events-none flex">
            <div className="flex-1 bg-sky-50/30 flex items-start justify-start p-4">
              <span className="text-xs font-bold text-sky-700 uppercase tracking-wider bg-white/80 px-2 py-1 rounded">
                Reactants
              </span>
            </div>
            <div className="w-px border-l-2 border-dashed border-slate-400" />
            <div className="flex-1 bg-green-50/30 flex items-start justify-end p-4">
              <span className="text-xs font-bold text-green-700 uppercase tracking-wider bg-white/80 px-2 py-1 rounded">
                Products
              </span>
            </div>
          </div>
        )}

        {/* Accessibility: hidden DOM overlay for screen readers */}
        <div className="sr-only" role="region" aria-live="polite" aria-atomic="true">
          <p>
            Scene contains {scene.atoms.length} atoms and {scene.bonds.length}{" "}
            bonds.
          </p>
        </div>
      </div>

      {pendingQuiz && (
        <ExplanationQuizModal
          quiz={pendingQuiz.quiz}
          explanationText={pendingQuiz.explanationText}
          onAnswer={(correct) => {
            const text = pendingQuiz.explanationText;
            setPendingQuiz(null);
            void finalizeMission(correct, text);
          }}
        />
      )}
    </main>
  );
}
