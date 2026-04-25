"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/store/gameStore";
import { useProgressStore } from "@/store/progressStore";
import { audio } from "@/lib/audio";
import type { ContentBundle } from "@/data/loader";
import Molecule3DViewer from "./Molecule3DViewer";
import AtomLedger from "./AtomLedger";
import {
  Undo,
  Redo,
  Lightbulb,
  CheckCircle,
  ArrowLeft,
  RotateCcw,
  X,
  Box,
  Trash2,
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
  const selectedAtomId = useGameStore((s) => s.selectedAtomId);
  const selectedBondId = useGameStore((s) => s.selectedBondId);
  const removeAtom = useGameStore((s) => s.removeAtom);
  const removeBond = useGameStore((s) => s.removeBond);

  const [show3D, setShow3D] = useState(false);
  const [canvasCenterX, setCanvasCenterX] = useState(400);
  const [showInteractionHint, setShowInteractionHint] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

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
    useHint(t("feedback.invalid_bond"));
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
            onClick={() => router.push(`/worlds?world=${mission.worldId}`)}
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
              <p className="text-xs text-slate-500 hidden sm:block truncate">
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
                ? "Tap two atoms to bond. Long-press an atom — or tap a bond — to delete."
                : "Drag to move, click two atoms to bond. Right-click an atom (or click a bond) to delete."}
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

      {/* Atom inventory tray */}
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

      {/* Atom Ledger for reaction missions */}
      {reactionMode && (
        <AtomLedger elements={content.elements} centerX={canvasCenterX} />
      )}

      {/* Bottom action bar */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-3 bg-white border-t border-slate-200">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            onClick={() => { audio.uiClick(); handleHint(); }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium transition-colors touch-target-lg ${
              showHint
                ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={showHint ? t("game.hide_hint") : t("game.hint")}
          >
            <Lightbulb className="w-5 h-5" />
            <span className="hidden sm:inline">
              {showHint ? t("game.hide_hint") : t("game.hint")}
            </span>
            {hintState.hintsUsed > 0 && (
              <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded-full">
                {hintState.hintsUsed}
              </span>
            )}
          </button>

          {targetMolecule && (
            <button
              onClick={() => { audio.uiClick(); setShow3D(true); }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors touch-target-lg"
              aria-label={t("game.view_3d")}
            >
              <Box className="w-5 h-5" />
              <span className="hidden sm:inline">{t("game.view_3d")}</span>
            </button>
          )}
        </div>

        <button
          onClick={handleCheck}
          disabled={isMissionComplete}
          className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors touch-target-lg shrink-0"
        >
          <CheckCircle className="w-5 h-5" />
          <span>{t("game.check")}</span>
        </button>
      </div>

      {/* Hint panel */}
      {showHint && (
        <div className="absolute bottom-[72px] sm:bottom-20 left-2 right-2 sm:left-auto sm:right-4 sm:w-80 max-h-[40vh] overflow-y-auto p-3 sm:p-4 rounded-xl bg-yellow-50 border border-yellow-200 shadow-lg z-10">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-yellow-800">{hintText}</p>
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
            <h3 className="text-2xl font-bold mb-2">{t("game.mission_complete")}</h3>
            <p className="text-slate-600 mb-6">
              {t(`missions.star_${scoreState.stars}` as const)}
            </p>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3].map((s) => (
                <svg
                  key={s}
                  className={`w-10 h-10 ${
                    s <= scoreState.stars
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-slate-200"
                  }`}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/worlds")}
                className="flex-1 py-3 rounded-xl border border-slate-300 font-medium hover:bg-slate-50 transition-colors"
              >
                {t("game.continue")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
