"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { loadContent, clearContentCache, type ContentBundle, getString } from "@/data/loader";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import { saveSlot, saveMissionProgress } from "@/lib/db";
import { validateSceneMolecule, validateSceneMolecules } from "@/engine/molecule";
import { validateReactionMission } from "@/engine/reaction";
import { validateBond } from "@/engine/bond";
import { nudgePosition, findNearestAtom } from "@/engine/interaction";
import { calculateScore } from "@/engine/scoring";
import { analyzeAttempt } from "@/engine/hints";
import { evaluateBadges } from "@/engine/badges";
import { recordEvent } from "@/lib/telemetry";
import GameHUD from "@/components/GameHUD";
import CanvasAccessibilityOverlay from "@/components/CanvasAccessibilityOverlay";
import ExplanationQuizModal from "@/components/ExplanationQuizModal";
import OnboardingCoachmark from "@/components/OnboardingCoachmark";
import ZoomTutorialCoachmark from "@/components/ZoomTutorialCoachmark";
import { goBackOr } from "@/lib/navigation";
import { ArrowRight } from "lucide-react";
import type { ExplanationQuiz, SceneAtom, SceneBond } from "@/types";

const PixiApp = dynamic(() => import("@/game/PixiApp"), { ssr: false });

export default function GamePage() {
  const router = useRouter();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const updateProgress = useProgressStore((s) => s.updateProgress);
  const markOnboardingComplete = useProgressStore(
    (s) => s.markOnboardingComplete
  );
  const addDiscoveryRecord = useProgressStore((s) => s.addDiscoveryRecord);
  const recordBadgeAward = useProgressStore((s) => s.recordBadgeAward);

  const isOnboarding = currentProfile?.onboardingCompleted === false;
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(false);

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
  const recordAttempt = useGameStore((s) => s.recordAttempt);

  const [content, setContent] = useState<ContentBundle | null>(null);
  const [contentError, setContentError] = useState<Error | null>(null);
  const [contentReloadKey, setContentReloadKey] = useState(0);
  const [pendingQuiz, setPendingQuiz] = useState<{
    quiz: ExplanationQuiz;
    explanationText: string;
  } | null>(null);

  const finalizeMission = useCallback(
    async (explanationCorrect: boolean | null, explanationText: string) => {
      if (!mission || !content) return;
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

        // First successful mission graduates the player from onboarding.
        if (currentProfile.onboardingCompleted === false) {
          await markOnboardingComplete();
        }

        // Notebook discovery — write a sticker for this mission. The
        // helper dedupes so replays don't spam the notebook.
        await addDiscoveryRecord({
          profileId: currentProfile.id,
          kind: "mission-complete",
          refId: mission.missionId,
          label: mission.title,
          explanation: explanationText,
        });

        // Badge evaluation. We re-read progress *after* save so the
        // evaluator sees the just-completed mission and any prior wins.
        const matchedMoleculeId =
          mission.objectiveType === "build-molecule"
            ? (mission.allowedMolecules[0] ?? null)
            : null;
        const storeState = useProgressStore.getState();
        const earned = evaluateBadges(content.badges, {
          justCompleted: mission,
          starsEarned: calc.stars,
          hintsUsed: hintState.hintsUsed,
          matchedMoleculeId,
          allProgress: storeState.progress,
          allMissions: content.missions,
          allDiscoveries: storeState.discoveries,
          alreadyEarned: storeState.badges,
        });
        for (const def of earned) {
          await recordBadgeAward(def.badgeId);
        }

        // Telemetry: privacy-reviewed event for mastery / engagement.
        // No free-text; everything in this payload is a known scalar.
        const startedAt = scoreState.startTime || Date.now();
        await recordEvent({
          profileId: currentProfile.id,
          kind: "mission_complete",
          missionId: mission.missionId,
          worldId: mission.worldId,
          ageBand: mission.ageBand,
          stars: calc.stars,
          hintsUsed: hintState.hintsUsed,
          attempts: scoreState.attempts + 1,
          durationMs: Math.max(0, Date.now() - startedAt),
        }).catch(() => {});
      }

      showFeedback(explanationText, "success");
    },
    [
      mission,
      content,
      hintState,
      scoreState,
      currentProfile,
      markOnboardingComplete,
      completeMission,
      showFeedback,
      updateProgress,
      addDiscoveryRecord,
      recordBadgeAward,
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

    // Helper: any failed Check is also a recorded attempt so the adaptive
    // hint engine can see repeat patterns. The outcome is derived from the
    // current scene against the mission target.
    const recordFailure = (errorText: string) => {
      const analysis = analyzeAttempt({
        mission,
        atoms: scene.atoms,
        bonds: scene.bonds,
        molecules: content.molecules,
        elements: content.elements,
      });
      recordAttempt(analysis.outcome, analysis.detail);
      showFeedback(errorText, "error");
    };

    if (mission.objectiveType === "build-molecule") {
      // Some build-molecule missions list more than one target (e.g.
      // "Ionic vs Covalent" wants water + sodium chloride built side
      // by side). The single-molecule validator collapses the whole
      // scene into one match attempt, which fails as soon as the
      // scene has two disconnected molecules and then surfaces a
      // chemistry-wrong "link them with bonds" message — water and
      // NaCl don't share bonds. Dispatch on the success-condition
      // shape so multi-target missions use the per-component matcher.
      const requiredMoleculeIds = mission.successConditions
        .filter(
          (c): c is { type: "build-molecule"; targetMoleculeId: string } =>
            c.type === "build-molecule"
        )
        .map((c) => c.targetMoleculeId);

      if (requiredMoleculeIds.length > 1) {
        const result = validateSceneMolecules(
          content.molecules,
          requiredMoleculeIds,
          scene.atoms,
          scene.bonds
        );
        if (result.matches) {
          // Stitch every matched molecule's explanation into the
          // success blurb so the notebook entry captures the chemistry
          // for both bond types — that's the lesson of this mission.
          const explanations = requiredMoleculeIds
            .map((id) =>
              getString(content.strings, `explanation_${id}`, "en")
            )
            .filter((t) => t && !t.startsWith("explanation_"));
          const explanation =
            explanations.length > 0 ? explanations.join(" ") : "Great job!";
          await handleSuccess(explanation);
        } else {
          recordFailure(result.explanation);
        }
      } else {
        const result = validateSceneMolecule(
          content.molecules,
          scene.atoms,
          scene.bonds
        );
        if (result.matches) {
          const targetMoleculeId = mission.allowedMolecules[0];
          const molecule = content.molecules.find(
            (m) => m.moleculeId === targetMoleculeId
          );
          const explanation = molecule
            ? getString(content.strings, `explanation_${molecule.moleculeId}`, "en")
            : "Great job!";
          await handleSuccess(explanation);
        } else {
          recordFailure(result.explanation);
        }
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
          recordFailure("Build an atom with the right number of particles.");
        }
      }
    } else if (mission.objectiveType === "count-atoms") {
      const targets = mission.successConditions.flatMap((c) =>
        c.type === "count-atoms" ? [c] : []
      );
      const counts = new Map<string, number>();
      for (const a of scene.atoms) {
        counts.set(a.elementId, (counts.get(a.elementId) ?? 0) + 1);
      }
      const wrong = targets.find(
        (t) => (counts.get(t.element) ?? 0) !== t.count
      );
      if (!wrong) {
        await handleSuccess("You placed the right number of each atom!");
      } else {
        const have = counts.get(wrong.element) ?? 0;
        recordFailure(
          `You have ${have} ${wrong.element} atoms — the target is ${wrong.count}.`
        );
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
          recordFailure(result.explanation);
        }
      }
    } else {
      showFeedback("Checking...", "info");
    }
  }, [mission, content, scene, handleSuccess, showFeedback, recordAttempt]);

  useEffect(() => {
    if (!currentProfile) {
      router.replace("/");
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
      const detail = (e as CustomEvent).detail as {
        elementId: string;
        side?: "reactants" | "products";
      };
      if (!detail?.elementId) return;

      const canvas = document.querySelector("canvas");
      const rect = canvas?.getBoundingClientRect();
      const state = useGameStore.getState();
      const isReaction = state.reactionMode;
      // Reaction missions use side-labeled tray buttons; honor the
      // requested half so atoms can be placed on the products side
      // instead of always landing on the reactants side. Non-reaction
      // missions ignore `side` and spawn at canvas center.
      const reactionAnchor =
        detail.side === "products" ? 0.75 : 0.25;
      const x = rect
        ? (isReaction ? rect.width * reactionAnchor : rect.width / 2) +
          (Math.random() - 0.5) * 100
        : (isReaction ? (detail.side === "products" ? 600 : 200) : 400);
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
        // Stamp the side intent onto the atom in reaction missions so
        // ledger + validation key off the button the player pressed,
        // not a centerX guess that breaks on narrow viewports or after
        // pan/zoom. Plain spawns (non-reaction missions) leave it
        // undefined.
        ...(isReaction && detail.side ? { side: detail.side } : {}),
      };
      addAtom(atom);
    };
    window.addEventListener("sparklab-add-atom", handler as EventListener);
    return () =>
      window.removeEventListener("sparklab-add-atom", handler as EventListener);
  }, [addAtom, content]);

  // Telemetry: fire mission_start when a mission becomes active. We
  // gate on currentProfile so anonymous /game visits don't emit.
  useEffect(() => {
    if (!mission || !currentProfile) return;
    void recordEvent({
      profileId: currentProfile.id,
      kind: "mission_start",
      missionId: mission.missionId,
      worldId: mission.worldId,
      ageBand: mission.ageBand,
    }).catch(() => {});
  }, [mission?.missionId, currentProfile?.id]);

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
      <div className="flex flex-col items-center justify-center min-h-dvh p-4">
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
            onClick={() => goBackOr(router, "/")}
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
      <div className="flex flex-col items-center justify-center min-h-dvh p-4">
        <p className="text-slate-500">No mission selected.</p>
        <button
          onClick={() => goBackOr(router, "/worlds")}
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

        {/* Reaction mode zone overlay. Soft tinted halves bracket
            the canvas midline; an arrow chip sits on the divider so
            the "reactants → products" metaphor reads at a glance,
            especially on mobile where the two halves are narrow. */}
        {reactionMode && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Side gradient washes — fade outward from each edge so
                the visual emphasis is on the zone, but the canvas
                center stays cleanest where the atoms typically sit. */}
            <div className="absolute inset-y-0 left-0 right-1/2 bg-gradient-to-r from-sky-100/50 to-sky-50/0" />
            <div className="absolute inset-y-0 right-0 left-1/2 bg-gradient-to-l from-green-100/50 to-green-50/0" />

            {/* Vertical divider line at midline. Solid in the center
                so it reads as a real boundary, fading at top/bottom
                so it doesn't crowd the corners. */}
            <div className="absolute inset-y-6 left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-slate-300/0 via-slate-400/70 to-slate-300/0" />

            {/* Center arrow chip — chemistry's left-to-right
                "reactants → products" notation, made literal. */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md ring-1 ring-slate-200 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>

            {/* Side labels — subtle pills in the top corners, tinted
                to match each zone so they feel like part of the
                background rather than overlaid UI. */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/85 ring-1 ring-sky-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-sky-700">
              Reactants
            </div>
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/85 ring-1 ring-green-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-green-700">
              Products
            </div>
          </div>
        )}

        {/* Onboarding coachmark — first-run guidance, scene-state-driven. */}
        {isOnboarding && !coachmarkDismissed && (
          <OnboardingCoachmark onDismiss={() => setCoachmarkDismissed(true)} />
        )}

        {/* Zoom tutorial coachmark — small animated card in the
            canvas corner that loops a "zoom in reveals nucleus +
            shells" demo. Self-dismisses after 14s and remembers the
            dismissal in localStorage so returning players don't see
            it on every mission. Suppressed during the first-run
            onboarding flow so we're not stacking two coachmarks. */}
        {!isOnboarding && <ZoomTutorialCoachmark />}

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
