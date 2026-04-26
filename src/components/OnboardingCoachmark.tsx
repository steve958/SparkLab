"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";

// Contextual coachmark that walks a first-run player through the very
// first interactions inside the game scene. Driven by scene state, not
// by clock or scripted timeline — the player advances when they DO the
// thing, which is the play-feel-first design (Phase 1 Q1: game-designer-
// owned script).
//
// Three states tracked:
//   1. empty scene   -> "Tap H below to add a Hydrogen atom"
//   2. atom present  -> "Now tap Check to see what you made"
//   3. mission done  -> handed off to the standard mission-complete overlay
//      (this component renders nothing in that state)
//
// TODO(game-designer): replace placeholder text with the canonical
// onboarding microcopy.

interface OnboardingCoachmarkProps {
  onDismiss: () => void;
}

type CoachStep = "empty" | "has-atom" | "done";

export default function OnboardingCoachmark({
  onDismiss,
}: OnboardingCoachmarkProps) {
  const sceneAtoms = useGameStore((s) => s.scene.atoms);
  const isMissionComplete = useGameStore((s) => s.isMissionComplete);

  const step: CoachStep = isMissionComplete
    ? "done"
    : sceneAtoms.length > 0
      ? "has-atom"
      : "empty";

  // Auto-dismiss when the mission completes; the standard mission-complete
  // overlay takes over. The actual onboardingCompleted flag is set by the
  // game page when the mission finalizes.
  useEffect(() => {
    if (step === "done") onDismiss();
  }, [step, onDismiss]);

  const [hidden, setHidden] = useState(false);
  if (hidden || step === "done") return null;

  // The atom tray sits above the canvas (top of the play area) and the
  // Check button sits below it. We anchor the coachmark at the relevant
  // edge per step so the pointer-arrow visibly points at what to tap.
  const anchorTop = step === "empty";

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <div
        className={`absolute left-1/2 -translate-x-1/2 max-w-xs px-4 pointer-events-auto ${
          anchorTop ? "top-3 sm:top-4" : "bottom-24 sm:bottom-28"
        }`}
      >
        {/* Pointer arrow above the chip when anchoring to the top so it
            visually points at the atom tray. */}
        {anchorTop && (
          <div className="flex justify-center mb-1" aria-hidden="true">
            <div
              className="w-3 h-3 rotate-45 mt-2 bg-primary"
              style={{ boxShadow: "0 -2px 2px rgba(0,0,0,0.05)" }}
            />
          </div>
        )}
        <div
          role="status"
          aria-live="polite"
          className="bg-primary text-white rounded-xl px-4 py-3 shadow-lg flex items-start gap-3 animate-pulse"
          style={{ animationDuration: "2s" }}
        >
          <span className="text-2xl shrink-0" aria-hidden="true">
            👋
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">
              {step === "empty"
                ? "Tap the H button up here to add a Hydrogen atom."
                : "Nice! Now tap Check below to test it."}
            </p>
            <button
              onClick={() => setHidden(true)}
              className="text-[11px] font-medium text-white/80 hover:text-white underline mt-1"
            >
              I got it from here
            </button>
          </div>
        </div>
        {/* Pointer arrow below the chip when anchoring to the bottom. */}
        {!anchorTop && (
          <div className="flex justify-center mt-1" aria-hidden="true">
            <div
              className="w-3 h-3 rotate-45 -mt-2 bg-primary"
              style={{ boxShadow: "0 2px 2px rgba(0,0,0,0.05)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
