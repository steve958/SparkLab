"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, SkipForward } from "lucide-react";
import { useProgressStore } from "@/store/progressStore";
import { useGameStore } from "@/store/gameStore";
import { loadContent } from "@/data/loader";

// First-run welcome screen. Shown to a profile whose `onboardingCompleted`
// flag is not set. Beats: greet by name → "ready?" → load first mission.
//
// Per Phase 1 design decision Q1, copy is owned by the game designer.
// Strings here are placeholders the game designer should rewrite for
// play-feel — short, punchy, no pedagogy lead.
//
// TODO(game-designer): replace placeholder strings with the canonical
// onboarding script. The structure below should remain stable; only the
// `text` content needs to change.

const FIRST_MISSION_ID = "f01_build_h_atom";

export default function OnboardingIntro() {
  const router = useRouter();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const markOnboardingComplete = useProgressStore(
    (s) => s.markOnboardingComplete
  );
  const initMission = useGameStore((s) => s.initMission);

  if (!currentProfile) return null;

  const handleStart = async () => {
    // Load content, find the first mission, init it, and route to /game.
    // We do *not* mark onboarding complete here — that happens after the
    // first mission is finished, so a player who bails halfway gets the
    // intro again next time.
    const content = await loadContent();
    const mission = content.missions.find(
      (m) => m.missionId === FIRST_MISSION_ID
    );
    if (!mission) {
      // Fallback: no first mission in content; treat as onboarded so the
      // player isn't stuck on the welcome screen.
      await markOnboardingComplete();
      return;
    }
    initMission(mission);
    // Encode mission id in the URL so reloads / SW-driven auto-
    // reloads can restore the mission instead of dropping the
    // player on a "No mission selected" screen.
    router.push(`/game?m=${encodeURIComponent(mission.missionId)}`);
  };

  const handleSkip = async () => {
    await markOnboardingComplete();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 max-w-md mx-auto text-center">
      <Image
        src="/icons/sparklab-logo.png"
        alt="SparkLab"
        width={112}
        height={112}
        priority
        className="w-24 h-24 sm:w-28 sm:h-28"
      />

      <div>
        <p className="text-sm font-semibold text-primary uppercase tracking-wide">
          Welcome to SparkLab
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-1">
          Hi, {currentProfile.name}!
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-3">
          Ready to build your first atom? It only takes a minute.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleStart}
          className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary-hover transition-colors touch-target-lg"
          autoFocus
        >
          Let&apos;s go
          <ArrowRight className="w-5 h-5" />
        </button>

        <button
          onClick={handleSkip}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors touch-target text-sm font-medium"
        >
          <SkipForward className="w-4 h-4" />
          Skip the tutorial
        </button>
      </div>
    </div>
  );
}
