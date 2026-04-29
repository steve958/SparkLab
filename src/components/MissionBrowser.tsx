"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
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
import MoleculePreview from "./MoleculePreview";
import { recordEvent } from "@/lib/telemetry";

interface MissionBrowserProps {
  content: ContentBundle;
  worldId: string;
}

export default function MissionBrowser({ content, worldId }: MissionBrowserProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const world = content.worlds.find((w) => w.worldId === worldId);
  const missions = content.missions.filter((m) => m.worldId === worldId);
  const localizedMissionTitle = (m: Mission) =>
    t(`content.missions.${m.missionId}.title`, { defaultValue: m.title });
  const localizedMissionBrief = (m: Mission) =>
    t(`content.missions.${m.missionId}.brief`, { defaultValue: m.brief });
  const progress = useProgressStore((s) => s.progress);
  const isMissionUnlocked = useProgressStore((s) => s.isMissionUnlocked);
  const masteryResults = useProgressStore((s) => s.masteryResults);
  const recordMasteryResult = useProgressStore((s) => s.recordMasteryResult);
  const currentProfileId = useProgressStore((s) => s.currentProfile?.id);
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
          {t("worlds.back_to_worlds")}
        </button>
      </div>
    );
  }

  const localizedWorldName = t(`content.worlds.${world.worldId}.name`, {
    defaultValue: world.name,
  });
  const localizedWorldDesc = t(
    `content.worlds.${world.worldId}.description`,
    { defaultValue: world.description }
  );

  const handleSelectMission = (mission: Mission) => {
    if (!isMissionUnlocked(mission.missionId, mission.prerequisites)) return;
    initMission(mission);
    // Encode the mission id in the URL so a refresh, a SW-driven
    // auto-reload, or a direct deep link to /game can restore the
    // mission. Without this, a reload on /game produces "No mission
    // selected" because the in-memory store starts empty.
    router.push(`/game?m=${encodeURIComponent(mission.missionId)}`);
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

  // Pre-check is the "Take it" entry state. Originally only offered
  // when the player hadn't earned any stars yet, but that left a dead
  // state once a player jumped straight into a mission and skipped the
  // gate (card body went blank — only the icon rendered). Now any
  // not-yet-mastered world with no pre-check on file shows the
  // "Take it" CTA, with copy that adapts to whether they've started.
  const showPreCheckCta = !preTaken && !worldMastered;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-10 sm:pb-8">
      <button
        onClick={() => goBackOr(router, "/worlds")}
        className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-3 sm:mb-6 touch-target"
      >
        <ArrowLeft className="w-5 h-5" />
        {t("worlds.back_to_worlds")}
      </button>

      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: world.themeColor }}>
          {localizedWorldName}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1">{localizedWorldDesc}</p>
      </div>

      {/* Mastery check entry point. Pre-check is offered before the
          player has earned any stars; post-check unlocks once the world
          is mastered. The (pre, post) score pair is the +pp lift signal
          the v2 roadmap measures against. */}
      {masteryCheck && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl border-2 border-amber-200 bg-amber-50/60 flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {showPreCheckCta && (
              <>
                <p className="text-sm font-semibold text-amber-900">
                  {completedCount === 0
                    ? "Quick check before you start"
                    : "Take the pre-check"}
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {completedCount === 0
                    ? "3 questions — see what you already know."
                    : "3 questions — set a baseline to compare against later."}
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
                  {preResult
                    ? `Pre: ${preResult.correctCount}/${preResult.totalCount} — see how much you've learned.`
                    : "See how much you've learned."}
                </p>
              </>
            )}
            {worldMastered && postTaken && (
              <>
                <p className="text-sm font-semibold text-amber-900">
                  {preResult && postResult
                    ? `Mastery: ${preResult.correctCount}/${preResult.totalCount} → ${postResult.correctCount}/${postResult.totalCount}`
                    : `Mastery: ${postResult?.correctCount ?? 0}/${postResult?.totalCount ?? 0}`}
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Nice work — that&apos;s real chemistry learning.
                </p>
              </>
            )}
          </div>
          {showPreCheckCta && (
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
          worldName={localizedWorldName}
          phase={masteryModalPhase}
          questions={masteryCheck[masteryModalPhase]}
          onCancel={() => setMasteryModalPhase(null)}
          onFinish={async (correctCount) => {
            const totalCount = masteryCheck[masteryModalPhase].length;
            await recordMasteryResult({
              worldId,
              phase: masteryModalPhase,
              correctCount,
              totalCount,
            });
            if (currentProfileId) {
              void recordEvent({
                profileId: currentProfileId,
                kind: "mastery_check",
                worldId,
                phase: masteryModalPhase,
                correctCount,
                totalCount,
              }).catch(() => {});
            }
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
              .map((preId) => {
                const pre = content.missions.find((m) => m.missionId === preId);
                return pre ? localizedMissionTitle(pre) : undefined;
              })
              .filter(Boolean);
            lockTitle = t("missions.unlock_tooltip", {
              titles: preTitles.join(", "),
            });
          }

          // Resolve the mission's primary target molecule (for
          // build-molecule missions, the first success condition's
          // moleculeId). null for run-reaction / build-atom missions
          // — those skip the preview tile entirely.
          let targetMolecule: typeof content.molecules[number] | null = null;
          if (mission.objectiveType === "build-molecule") {
            const buildCondition = mission.successConditions.find(
              (c) => c.type === "build-molecule"
            );
            const moleculeId =
              buildCondition && buildCondition.type === "build-molecule"
                ? buildCondition.targetMoleculeId
                : mission.allowedMolecules[0];
            if (moleculeId) {
              targetMolecule =
                content.molecules.find((m) => m.moleculeId === moleculeId) ??
                null;
            }
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
                  {t("worlds.next_up")}
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

              {/* Molecule preview tile — only on build-molecule
                  missions. Mirrors the in-game HUD target row and the
                  notebook entry render so kids see "this is what
                  you're going to build" before they pick the mission.
                  Hidden when locked so the lock icon stays the focal
                  point on gated missions. */}
              {targetMolecule && unlocked && (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 p-0.5">
                  <MoleculePreview
                    molecule={targetMolecule}
                    elements={content.elements}
                    size={36}
                  />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm sm:text-lg truncate">
                    {localizedMissionTitle(mission)}
                  </h3>
                  {isCompleted && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-100 px-1.5 py-0.5 rounded shrink-0">
                      {t("worlds.replay")}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 line-clamp-1 sm:line-clamp-1">
                  {localizedMissionBrief(mission)}
                </p>
                <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[11px] sm:text-xs text-slate-600">
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {t("missions.minutes", { count: mission.estimatedMinutes })}
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
