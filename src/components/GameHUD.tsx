"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import { audio } from "@/lib/audio";
import { goBackOr } from "@/lib/navigation";
import { generateAdaptiveHint } from "@/engine/hints";
import { recordEvent } from "@/lib/telemetry";
import type { ContentBundle } from "@/data/loader";
import type { Element } from "@/types";
import Molecule3DViewer from "./Molecule3DViewer";
import AtomLedger from "./AtomLedger";
import AtomDetailsModal from "./AtomDetailsModal";
import {
  Undo,
  Redo,
  Lightbulb,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X,
  Box,
  Trash2,
  Info,
} from "lucide-react";

interface GameHUDProps {
  content: ContentBundle;
}

export default function GameHUD({ content }: GameHUDProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const mission = useGameStore((s) => s.currentMission);
  const scene = useGameStore((s) => s.scene);
  const scoreState = useGameStore((s) => s.scoreState);
  const hintState = useGameStore((s) => s.hintState);
  const showHint = useGameStore((s) => s.showHint);
  const hintText = useGameStore((s) => s.hintText);
  const hintAction = useGameStore((s) => s.hintAction);
  const isMissionComplete = useGameStore((s) => s.isMissionComplete);
  const feedbackMessage = useGameStore((s) => s.feedbackMessage);
  const feedbackType = useGameStore((s) => s.feedbackType);
  const reactionMode = useGameStore((s) => s.reactionMode);

  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const useHint = useGameStore((s) => s.useHint);
  const dismissHint = useGameStore((s) => s.dismissHint);
  const dismissFeedback = useGameStore((s) => s.dismissFeedback);
  const resetScene = useGameStore((s) => s.resetScene);
  const initMission = useGameStore((s) => s.initMission);
  const selectedAtomId = useGameStore((s) => s.selectedAtomId);
  const selectedBondId = useGameStore((s) => s.selectedBondId);
  const removeAtom = useGameStore((s) => s.removeAtom);
  const removeBond = useGameStore((s) => s.removeBond);

  const progress = useProgressStore((s) => s.progress);
  const currentProfileId = useProgressStore((s) => s.currentProfile?.id);
  const isMissionUnlocked = useProgressStore((s) => s.isMissionUnlocked);

  // Next unlocked, not-yet-3-starred mission in the current world (forward-only).
  // null when this is the last available mission and the player should head back
  // to the world list.
  const nextMission = useMemo(() => {
    if (!mission) return null;
    const sameWorld = content.missions.filter(
      (m) => m.worldId === mission.worldId
    );
    const currentIdx = sameWorld.findIndex(
      (m) => m.missionId === mission.missionId
    );
    if (currentIdx === -1) return null;
    for (let i = currentIdx + 1; i < sameWorld.length; i++) {
      const candidate = sameWorld[i];
      if (!isMissionUnlocked(candidate.missionId, candidate.prerequisites)) {
        continue;
      }
      const stars =
        progress.find((p) => p.missionId === candidate.missionId)?.stars ?? 0;
      if (stars >= 3) continue;
      return candidate;
    }
    return null;
  }, [mission, content.missions, progress, isMissionUnlocked]);

  const [show3D, setShow3D] = useState(false);
  const [showAtomDetails, setShowAtomDetails] = useState(false);

  // Element of the currently-selected atom — used by the "Element
  // info" pill button + the AtomDetailsModal it opens. Null when no
  // atom (or a non-existent one) is selected.
  const selectedElement = useMemo(() => {
    if (!selectedAtomId) return null;
    const atom = scene.atoms.find((a) => a.id === selectedAtomId);
    if (!atom) return null;
    return content.elements.find((e) => e.symbol === atom.elementId) ?? null;
  }, [selectedAtomId, scene.atoms, content.elements]);
  const [canvasCenterX, setCanvasCenterX] = useState(400);
  const [showInteractionHint, setShowInteractionHint] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Snapshot the player's previous best at mission-init time so the
  // complete overlay can distinguish first-clear / new-best / replay.
  // Intentionally not depending on `progress` so this stays the value
  // at start, not the value after finalizeMission writes the new record.
  const [previousBestStars, setPreviousBestStars] = useState(0);
  useEffect(() => {
    if (!mission) return;
    const p = progress.find((rec) => rec.missionId === mission.missionId);
    setPreviousBestStars(p?.stars ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.missionId]);

  // World-mastery progress: how many missions in this world cleared at
  // 3 stars total. Drives the "Foundations: 3 / 10 perfect" line.
  const worldMastery = useMemo(() => {
    if (!mission) return null;
    const worldMissions = content.missions.filter(
      (m) => m.worldId === mission.worldId
    );
    const perfect = progress.filter(
      (p) =>
        p.stars >= 3 && worldMissions.some((m) => m.missionId === p.missionId)
    ).length;
    const world = content.worlds.find((w) => w.worldId === mission.worldId);
    return {
      worldName: world?.name ?? "",
      perfect,
      total: worldMissions.length,
    };
  }, [mission, content.missions, content.worlds, progress]);

  // Measure canvas width for atom ledger center line
  useEffect(() => {
    function measure() {
      const canvas = document.querySelector("canvas");
      if (canvas) {
        setCanvasCenterX(canvas.clientWidth / 2);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Detect touch capability and show interaction hint once per device
  useEffect(() => {
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);

    const dismissedKey = `sparklab_hint_dismissed_${mission?.missionId ?? "global"}`;
    if (mission && !localStorage.getItem(dismissedKey)) {
      setShowInteractionHint(true);
    }
  }, [mission]);

  const dismissInteractionHint = () => {
    setShowInteractionHint(false);
    const dismissedKey = `sparklab_hint_dismissed_${mission?.missionId ?? "global"}`;
    localStorage.setItem(dismissedKey, "1");
  };

  // Find target molecule for 3D view (first allowed molecule for build-molecule missions)
  const targetMolecule = useMemo(() => {
    if (!mission || mission.objectiveType !== "build-molecule") return null;
    const targetId = mission.allowedMolecules[0];
    if (!targetId) return null;
    return content.molecules.find((m) => m.moleculeId === targetId) ?? null;
  }, [mission, content.molecules]);

  // Find reaction equation for run-reaction missions
  const reactionEquation = useMemo(() => {
    if (!mission || mission.objectiveType !== "run-reaction") return null;
    const condition = mission.successConditions[0];
    if (condition?.type !== "run-reaction") return null;
    const reaction = content.reactions.find(
      (r) => r.reactionId === condition.targetReactionId
    );
    return reaction?.equationDisplay ?? null;
  }, [mission, content.reactions]);

  if (!mission) return null;

  const handleHint = () => {
    if (showHint) {
      dismissHint();
      return;
    }
    if (!mission) return;
    const result = generateAdaptiveHint(
      {
        mission,
        atoms: scene.atoms,
        bonds: scene.bonds,
        molecules: content.molecules,
        elements: content.elements,
      },
      hintState.hintsUsed,
      hintState.attempts
    );
    useHint(
      result.text,
      result.action as Parameters<typeof useHint>[1],
      Array.isArray(result.actionPayload)
        ? (result.actionPayload as string[])
        : []
    );
    if (currentProfileId) {
      const recentOutcome =
        hintState.attempts.length > 0
          ? hintState.attempts[hintState.attempts.length - 1].outcome
          : ("no-attempt-yet" as const);
      void recordEvent({
        profileId: currentProfileId,
        kind: "hint_used",
        missionId: mission.missionId,
        tier: result.tier,
        outcome: recentOutcome,
      }).catch(() => {});
    }
  };

  const handleCheck = () => {
    audio.uiClick();
    const event = new CustomEvent("sparklab-check-mission");
    window.dispatchEvent(event);
  };

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={() =>
              goBackOr(router, `/worlds?world=${mission.worldId}`)
            }
            className="p-2 rounded-lg hover:bg-slate-100 touch-target shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm sm:text-base truncate">
              {mission.title}
            </h2>
            {reactionEquation ? (
              <p className="text-xs text-primary font-mono font-medium truncate">
                {reactionEquation}
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {mission.brief}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          <button
            onClick={() => { audio.uiClick(); undo(); }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 touch-target disabled:opacity-30"
            aria-label={t("game.undo")}
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={() => { audio.uiClick(); redo(); }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 touch-target disabled:opacity-30"
            aria-label={t("game.redo")}
          >
            <Redo className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (selectedAtomId) {
                audio.uiClick();
                removeAtom(selectedAtomId);
              } else if (selectedBondId) {
                audio.uiClick();
                removeBond(selectedBondId);
              }
            }}
            disabled={!selectedAtomId && !selectedBondId}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 hover:text-red-600 touch-target disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={selectedBondId ? "Delete selected bond" : "Delete selected atom"}
            title={selectedBondId ? "Delete selected bond" : "Delete selected atom"}
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => { audio.uiClick(); resetScene(); }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 touch-target"
            aria-label={t("game.reset")}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Interaction hint banner */}
      {showInteractionHint && (
        <div className="flex items-start sm:items-center justify-between gap-2 px-2 sm:px-3 py-2 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-indigo-800 min-w-0">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              {isTouchDevice
                ? "Drag an atom to move it. Tap two atoms to bond. Long-press to delete."
                : "Drag an atom to move it. Click two atoms to bond. Right-click to delete."}
            </span>
          </div>
          <button
            onClick={dismissInteractionHint}
            className="p-1 rounded hover:bg-indigo-100 shrink-0 -mr-1"
            aria-label="Dismiss hint"
          >
            <X className="w-4 h-4 text-indigo-600" />
          </button>
        </div>
      )}

      {/* Atom inventory tray. Reaction missions split the tray into two
          side-labeled groups so the player can spawn atoms directly on
          the Reactants (left half) or Products (right half) of the canvas;
          the spawn handler in game/page.tsx reads `detail.side` to place
          the atom in the correct half. Non-reaction missions keep a single
          unlabeled tray. */}
      {reactionMode ? (
        <>
          {/* Mass-conservation explainer — reaction missions are confusing
              without it because the goal isn't "build a molecule" but
              "show the same atoms on both sides, regrouped". */}
          <div className="px-2 sm:px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-[11px] sm:text-xs text-amber-900 leading-snug">
            <span className="font-semibold">Conserve atoms:</span> place the
            starting atoms as molecules on the <span className="font-semibold text-sky-700">left</span>,
            then the <em>same</em> atoms regrouped as products on the{" "}
            <span className="font-semibold text-green-700">right</span>.
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200">
            <ReactionAtomGroup
              side="reactants"
              label="Reactants"
              tone="sky"
              allowedElements={mission.allowedElements}
              elements={content.elements}
            />
            <ReactionAtomGroup
              side="products"
              label="Products"
              tone="green"
              allowedElements={mission.allowedElements}
              elements={content.elements}
            />
          </div>
          <AtomLedger elements={content.elements} centerX={canvasCenterX} />
        </>
      ) : (
        <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto">
          <span className="text-xs font-medium text-slate-500 shrink-0 mr-1">
            {t("game.atoms_label")}
          </span>
          {mission.allowedElements.map((symbol) => {
            const element = content.elements.find((e) => e.symbol === symbol);
            if (!element) return null;
            return (
              <button
                key={symbol}
                onClick={() => {
                  const event = new CustomEvent("sparklab-add-atom", {
                    detail: { elementId: symbol },
                  });
                  window.dispatchEvent(event);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-primary hover:bg-sky-50 transition-colors shrink-0 touch-target"
                aria-label={`Add ${element.name} atom`}
              >
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: element.colorToken }}
                />
                <span className="font-bold text-sm">{symbol}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom action bar. Mobile: compact buttons with always-visible
          labels (no more icon-only mystery), wrapping if the left
          cluster runs out of horizontal room. Check stays pinned to
          the right and never wraps. */}
      <div className="flex items-start justify-between gap-2 p-2 sm:p-3 bg-white border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <button
            onClick={() => { audio.uiClick(); handleHint(); }}
            className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors touch-target ${
              showHint
                ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={showHint ? t("game.hide_hint") : t("game.hint")}
          >
            <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{showHint ? t("game.hide_hint") : t("game.hint")}</span>
            {hintState.hintsUsed > 0 && (
              <span className="text-[10px] sm:text-xs bg-slate-200 px-1.5 py-0.5 rounded-full leading-none">
                {hintState.hintsUsed}
              </span>
            )}
          </button>

          {targetMolecule && (
            <button
              onClick={() => { audio.uiClick(); setShow3D(true); }}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors touch-target"
              aria-label={t("game.view_3d")}
            >
              <Box className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{t("game.view_3d")}</span>
            </button>
          )}

          {/* Element info — appears only when an atom is selected so it
              doesn't clutter the bar by default. Single tap to open
              the full property modal for that element. */}
          {selectedElement && (
            <button
              onClick={() => {
                audio.uiClick();
                setShowAtomDetails(true);
              }}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors touch-target"
              aria-label={`Show ${selectedElement.name} details`}
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{selectedElement.name}</span>
            </button>
          )}
        </div>

        <button
          onClick={handleCheck}
          disabled={isMissionComplete}
          className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-sm bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors touch-target shrink-0"
        >
          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{t("game.check")}</span>
        </button>
      </div>

      {/* Hint panel — "show-me" tier gets a stronger visual treatment so
           the player knows the engine has escalated to direct guidance. */}
      {showHint && (
        <div
          className={`absolute bottom-[72px] sm:bottom-20 left-2 right-2 sm:left-auto sm:right-4 sm:w-80 max-h-[40vh] overflow-y-auto p-3 sm:p-4 rounded-xl shadow-lg z-10 border ${
            hintAction === "show-me"
              ? "bg-amber-100 border-amber-300"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          {hintAction === "show-me" && (
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 mb-1">
              Show me
            </p>
          )}
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm ${
                hintAction === "show-me"
                  ? "text-amber-900"
                  : "text-yellow-800"
              }`}
            >
              {hintText}
            </p>
            <button
              onClick={dismissHint}
              className="p-1 rounded hover:bg-yellow-100 shrink-0"
              aria-label="Dismiss hint"
            >
              <X className="w-4 h-4 text-yellow-600" />
            </button>
          </div>
        </div>
      )}

      {/* Feedback toast */}
      {feedbackMessage && (
        <div
          className={`absolute top-16 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-md mx-auto px-4 sm:px-6 py-3 rounded-xl shadow-lg z-10 text-white font-medium text-sm sm:text-base ${
            feedbackType === "success"
              ? "bg-success"
              : feedbackType === "error"
              ? "bg-error"
              : "bg-primary"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedbackMessage}</span>
            <button
              onClick={dismissFeedback}
              className="p-1 rounded hover:bg-white/20"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3D Viewer Modal */}
      {show3D && targetMolecule && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setShow3D(false)}
        >
          <div
            className="bg-white rounded-2xl p-3 sm:p-6 max-w-[95vw] sm:max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-bold">{t("game.view_3d_title")}</h3>
              <button
                onClick={() => setShow3D(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center">
              <Molecule3DViewer
                molecule={targetMolecule}
                elements={content.elements}
                width={Math.min(400, typeof window !== "undefined" ? window.innerWidth - 64 : 400)}
                height={Math.min(300, typeof window !== "undefined" ? Math.max(220, window.innerHeight * 0.45) : 300)}
              />
            </div>
            <p className="text-center text-sm text-slate-500 mt-3">
              {targetMolecule.displayName}
            </p>
          </div>
        </div>
      )}

      {/* Mission complete overlay */}
      {isMissionComplete && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            {/* Achievement badge: first-clear / new-best / mastered.
                Hidden when replaying a same-or-worse run. */}
            {(() => {
              const earned = scoreState.stars;
              const before = previousBestStars;
              if (earned <= 0) return null;
              if (before === 0) {
                return (
                  <div className="inline-block text-[11px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full mb-3">
                    First clear!
                  </div>
                );
              }
              if (earned > before) {
                return (
                  <div className="inline-block text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1 rounded-full mb-3">
                    New best
                  </div>
                );
              }
              if (earned === 3 && before === 3) {
                return (
                  <div className="inline-block text-[11px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-3 py-1 rounded-full mb-3">
                    Mastered
                  </div>
                );
              }
              return null;
            })()}

            <h3 className="text-2xl font-bold mb-2">{t("game.mission_complete")}</h3>
            <p className="text-slate-600 mb-6">
              {t(`missions.star_${scoreState.stars}` as const)}
            </p>
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3].map((s, idx) => (
                <svg
                  key={s}
                  className={`w-10 h-10 ${
                    s <= scoreState.stars
                      ? "text-yellow-400 fill-yellow-400 star-pop"
                      : "text-slate-200"
                  }`}
                  style={
                    s <= scoreState.stars
                      ? { animationDelay: `${idx * 200}ms` }
                      : undefined
                  }
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>

            {/* World-mastery progress line — only meaningful once a world
                actually has missions; suppressed for partial worlds. */}
            {worldMastery && worldMastery.total > 0 && (
              <p className="text-xs font-medium text-slate-600 mb-6">
                {worldMastery.worldName}: {worldMastery.perfect} of{" "}
                {worldMastery.total} missions perfect
              </p>
            )}
            <div className="flex flex-col gap-2">
              {nextMission && (
                <button
                  onClick={() => initMission(nextMission)}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
                >
                  Next mission
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() =>
                  goBackOr(
                    router,
                    mission ? `/worlds?world=${mission.worldId}` : "/worlds"
                  )
                }
                className="w-full py-3 rounded-xl border border-slate-300 font-medium hover:bg-slate-50 transition-colors"
              >
                {nextMission ? "Back to world" : t("game.continue")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Element details modal. Render inside the same fragment as
          the rest of the HUD so it lives above the canvas; the modal
          itself uses fixed positioning. */}
      {showAtomDetails && selectedElement && (
        <AtomDetailsModal
          element={selectedElement}
          onClose={() => setShowAtomDetails(false)}
        />
      )}
    </>
  );
}

// Side-labeled atom button row used by reaction missions. Buttons here
// dispatch the same `sparklab-add-atom` event but include `side` so the
// game page can spawn the atom in the correct half of the canvas
// instead of always landing on the reactants side.
type ReactionSide = "reactants" | "products";
function ReactionAtomGroup({
  side,
  label,
  tone,
  allowedElements,
  elements,
}: {
  side: ReactionSide;
  label: string;
  tone: "sky" | "green";
  allowedElements: string[];
  elements: Element[];
}) {
  const toneStyles =
    tone === "sky"
      ? {
          wrap: "bg-sky-50",
          label: "text-sky-700",
          btn: "hover:border-sky-500 hover:bg-sky-100",
        }
      : {
          wrap: "bg-green-50",
          label: "text-green-700",
          btn: "hover:border-green-500 hover:bg-green-100",
        };
  return (
    <div
      className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 overflow-x-auto ${toneStyles.wrap}`}
    >
      <span
        className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider shrink-0 mr-0.5 ${toneStyles.label}`}
      >
        {label}
      </span>
      {allowedElements.map((symbol) => {
        const element = elements.find((e) => e.symbol === symbol);
        if (!element) return null;
        return (
          <button
            key={`${side}-${symbol}`}
            onClick={() => {
              const event = new CustomEvent("sparklab-add-atom", {
                detail: { elementId: symbol, side },
              });
              window.dispatchEvent(event);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white border border-slate-200 transition-colors shrink-0 touch-target ${toneStyles.btn}`}
            aria-label={`Add ${element.name} atom to ${label}`}
          >
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: element.colorToken }}
            />
            <span className="font-bold text-sm">{symbol}</span>
          </button>
        );
      })}
    </div>
  );
}
