"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProgressStore } from "@/store/progressStore";
import { useGameStore } from "@/store/gameStore";
import { goBackOr } from "@/lib/navigation";
import type { Mission } from "@/types";
import type { ContentBundle } from "@/data/loader";
import {
  Star,
  Lock,
  Clock,
  ArrowLeft,
  CheckCircle,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import MasteryCheckModal from "./MasteryCheckModal";

interface MissionBrowserProps {
  content: ContentBundle;
  worldId: string;
}

export default function MissionBrowser({ content, worldId }: MissionBrowserProps) {
  const router = useRouter();
  const world = content.worlds.find((w) => w.worldId === worldId);
  const missions = content.missions.filter((m) => m.worldId === worldId);
  const progress = useProgressStore((s) => s.progress);
  const isMissionUnlocked = useProgressStore((s) => s.isMissionUnlocked);
  const masteryResults = useProgressStore((s) => s.masteryResults);
  const recordMasteryResult = useProgressStore((s) => s.recordMasteryResult);
  const initMission = useGameStore((s) => s.initMission);

  const [masteryModalPhase, setMasteryModalPhase] = useState<
    "pre" | "post" | null
  >(null);

  if (!world) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">World not found.</p>
        <button
          onClick={() => goBackOr(router, "/worlds")}
          className="mt-4 text-primary hover:underline"
        >
          Back to Worlds
        </button>
      </div>
    );
  }

  const handleSelectMission = (mission: Mission) => {
    if (!isMissionUnlocked(mission.missionId, mission.prerequisites)) return;
    initMission(mission);
    router.push("/game");
  };

  // Find the first unlocked mission with 0 stars (the "next up" mission)
  const nextUpMissionId = missions.find((m) => {
    const unlocked = isMissionUnlocked(m.missionId, m.prerequisites);
    const mp = progress.find((p) => p.missionId === m.missionId);
    return unlocked && (mp?.stars ?? 0) === 0;
  })?.missionId;

  // Mastery-check status: which phase (if any) is available right now.
  const masteryCheck = content.masteryChecks.find(
    (mc) => mc.worldId === worldId
  );
  const preTaken = masteryResults.some(
    (r) => r.worldId === worldId && r.phase === "pre"
  );
  const postTaken = masteryResults.some(
    (r) => r.worldId === worldId && r.phase === "post"
  );
  const completedCount = missions.filter((m) => {
    const mp = progress.find((p) => p.missionId === m.missionId);
    return (mp?.stars ?? 0) > 0;
  }).length;
  const worldMastered =
    missions.length > 0 && completedCount === missions.length;
  const preResult = masteryResults.find(
    (r) => r.worldId === worldId && r.phase === "pre"
  );
  const postResult = masteryResults.find(
    (r) => r.worldId === worldId && r.phase === "post"
  );

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
      <button
        onClick={() => goBackOr(router, "/worlds")}
        className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-3 sm:mb-6 touch-target"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Worlds
      </button>

      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: world.themeColor }}>
          {world.name}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1">{world.description}</p>
      </div>

      {/* Mastery check entry point. Pre-check is offered before the
          player has earned any stars; post-check unlocks once the world
          is mastered. The (pre, post) score pair is the +pp lift signal
          the v2 roadmap measures against. */}
      {masteryCheck && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl border-2 border-amber-200 bg-amber-50/60 flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {!preTaken && completedCount === 0 && (
              <>
                <p className="text-sm font-semibold text-amber-900">
                  Quick check before you start
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  3 questions — see what you already know.
                </p>
              </>
            )}
            {preTaken && !worldMastered && (
              <>
                <p className="text-sm font-semibold text-amber-900">
                  Pre-check done · {preResult?.correctCount ?? 0}/
                  {preResult?.totalCount ?? 0}
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Finish every mission to unlock the post-check.
                </p>
              </>
            )}
            {worldMastered && !postTaken && (
              <>
                <p className="text-sm font-semibold text-amber-900">
                  Post-check unlocked
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Pre: {preResult?.correctCount ?? 0}/
                  {preResult?.totalCount ?? 0} — see how much you&apos;ve
                  learned.
                </p>
              </>
            )}
            {worldMastered && postTaken && preResult && postResult && (
              <>
                <p className="text-sm font-semibold text-amber-900">
                  Mastery: {preResult.correctCount}/{preResult.totalCount} →{" "}
                  {postResult.correctCount}/{postResult.totalCount}
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Nice work — that&apos;s real chemistry learning.
                </p>
              </>
            )}
          </div>
          {!preTaken && completedCount === 0 && (
            <button
              onClick={() => setMasteryModalPhase("pre")}
              className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition-colors shrink-0"
            >
              Take it
            </button>
          )}
          {worldMastered && !postTaken && (
            <button
              onClick={() => setMasteryModalPhase("post")}
              className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition-colors shrink-0"
            >
              Take it
            </button>
          )}
        </div>
      )}

      {masteryCheck && masteryModalPhase && (
        <MasteryCheckModal
          worldName={world.name}
          phase={masteryModalPhase}
          questions={masteryCheck[masteryModalPhase]}
          onCancel={() => setMasteryModalPhase(null)}
          onFinish={async (correctCount) => {
            await recordMasteryResult({
              worldId,
              phase: masteryModalPhase,
              correctCount,
              totalCount: masteryCheck[masteryModalPhase].length,
            });
            setMasteryModalPhase(null);
          }}
        />
      )}

      <div className="grid gap-3 sm:gap-4">
        {missions.map((mission, index) => {
          const unlocked = isMissionUnlocked(
            mission.missionId,
            mission.prerequisites
          );
          const missionProgress = progress.find(
            (p) => p.missionId === mission.missionId
          );
          const stars = missionProgress?.stars ?? 0;
          const isCompleted = stars > 0;
          const isNextUp = mission.missionId === nextUpMissionId;

          // Build prerequisite tooltip for locked missions
          let lockTitle = "";
          if (!unlocked && mission.prerequisites.length > 0) {
            const preTitles = mission.prerequisites
              .map((preId) => content.missions.find((m) => m.missionId === preId)?.title)
              .filter(Boolean);
            lockTitle = `Complete ${preTitles.join(", ")} to unlock`;
          }

          return (
            <button
              key={mission.missionId}
              onClick={() => handleSelectMission(mission)}
              disabled={!unlocked}
              title={lockTitle}
              className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 text-left transition-all relative ${
                unlocked
                  ? "border-slate-200 bg-white hover:border-primary hover:shadow-md"
                  : "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
              } ${isNextUp ? "ring-2 ring-primary ring-offset-1" : ""}`}
            >
              {/* Badge: Next Up */}
              {isNextUp && (
                <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <ArrowRight className="w-3 h-3" />
                  Next Up
                </div>
              )}

              <div
                className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full font-bold text-base sm:text-lg shrink-0 ${
                  unlocked
                    ? isCompleted
                      ? "bg-green-100 text-green-700"
                      : "bg-sky-100 text-primary"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {unlocked ? (
                  isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    index + 1
                  )
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm sm:text-lg truncate">
                    {mission.title}
                  </h3>
                  {isCompleted && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-100 px-1.5 py-0.5 rounded shrink-0">
                      Replay
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 line-clamp-1 sm:line-clamp-1">
                  {mission.brief}
                </p>
                <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[11px] sm:text-xs text-slate-600">
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {mission.estimatedMinutes} min
                  </span>
                  {/* Star row inline with metadata on mobile so cards stay short. */}
                  <span className="flex sm:hidden items-center gap-0.5 ml-auto shrink-0">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= stars
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-200"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="hidden sm:inline truncate">{mission.standardsTags[0]}</span>
                </div>
              </div>

              {/* Star group only on tablet+; mobile shows stars inline above. */}
              <div className="hidden sm:flex gap-1 shrink-0">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-6 h-6 ${
                      s <= stars
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-slate-200"
                    }`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
