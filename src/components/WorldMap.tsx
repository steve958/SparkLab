"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Star, FlaskConical, FlaskRound, Flame, ArrowRight, CheckCircle } from "lucide-react";
import type { World, MissionProgress, Mission } from "@/types";

interface WorldMapProps {
  worlds: World[];
  missions: Mission[];
  progress: MissionProgress[];
}

// Schematic world map — nodes connected by edges, theme-colored, fully
// keyboard-accessible. No illustrated art (per Phase 1 design decision Q2).
//
// Layout: horizontal flow on tablet+, stacked column on mobile. Each node is
// a button. Connector lines are SVG, theme-colored on the "passed" side
// based on whether the predecessor world has any completed missions.

const WORLD_ICON: Record<string, typeof FlaskConical> = {
  foundations: FlaskRound,
  core: FlaskConical,
  reactions: Flame,
};

interface WorldStat {
  worldId: string;
  total: number;
  completed: number;
  totalStars: number;
  maxStars: number;
  isStarted: boolean;
  isMastered: boolean; // every mission completed at >=1 star
}

function statsFor(
  world: World,
  missions: Mission[],
  progress: MissionProgress[]
): WorldStat {
  const worldMissions = missions.filter((m) => m.worldId === world.worldId);
  const worldProgress = progress.filter((p) =>
    worldMissions.some((m) => m.missionId === p.missionId)
  );
  const completed = worldProgress.filter((p) => p.stars > 0).length;
  const totalStars = worldProgress.reduce((sum, p) => sum + p.stars, 0);
  return {
    worldId: world.worldId,
    total: worldMissions.length,
    completed,
    totalStars,
    maxStars: worldMissions.length * 3,
    isStarted: completed > 0,
    isMastered: worldMissions.length > 0 && completed === worldMissions.length,
  };
}

export default function WorldMap({ worlds, missions, progress }: WorldMapProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const stats = worlds.map((w) => statsFor(w, missions, progress));

  // "Next up" = the first world that isn't mastered. Drives the call-out.
  const nextUpIndex = stats.findIndex((s) => !s.isMastered);

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-1 sm:mb-2">
        {t("worlds.title")}
      </h1>
      <p className="text-slate-600 text-center text-sm sm:text-base mb-6 sm:mb-10">
        {t("worlds.subtitle")}
      </p>

      {/* The map itself: nodes in a row (or column on mobile) with connectors
          between consecutive worlds. The connector is rendered as part of
          each card except the last so we don't need absolute positioning. */}
      <ol className="flex flex-col sm:flex-row sm:items-stretch sm:justify-between gap-3 sm:gap-2">
        {worlds.map((world, i) => {
          const stat = stats[i];
          const next = i < worlds.length - 1 ? stats[i + 1] : null;
          const isNextUp = i === nextUpIndex;
          const Icon = WORLD_ICON[world.worldId] ?? FlaskConical;
          const localizedName = t(`content.worlds.${world.worldId}.name`, {
            defaultValue: world.name,
          });
          const localizedDesc = t(
            `content.worlds.${world.worldId}.description`,
            { defaultValue: world.description }
          );

          // Edge color: themed if predecessor has been started (visual
          // progression cue), neutral grey otherwise.
          const edgeActive = stat.isStarted;

          return (
            <li
              key={world.worldId}
              className="flex flex-col sm:flex-row items-center sm:items-stretch flex-1 min-w-0"
            >
              <button
                onClick={() => router.push(`/worlds?world=${world.worldId}`)}
                aria-label={t("worlds.open_aria", {
                  name: localizedName,
                  completed: stat.completed,
                  total: stat.total,
                })}
                className={`relative flex-1 w-full sm:w-auto flex sm:flex-col items-center gap-3 sm:gap-2 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isNextUp
                    ? "border-primary bg-white shadow-sm"
                    : stat.isMastered
                      ? "border-green-200 bg-green-50/50"
                      : "border-slate-200 bg-white"
                }`}
                style={{
                  // Focus ring color from the world theme so each world
                  // keeps its identity even when focused.
                  outlineColor: world.themeColor,
                }}
              >
                {isNextUp && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-3 sm:translate-x-0 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap">
                    <ArrowRight className="w-3 h-3" />
                    {stat.isStarted ? t("worlds.continue") : t("worlds.start_here")}
                  </span>
                )}
                {stat.isMastered && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-3 sm:translate-x-0 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap">
                    <CheckCircle className="w-3 h-3" />
                    {t("worlds.mastered")}
                  </span>
                )}

                {/* Themed circle with the world's icon */}
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: world.themeColor }}
                >
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                <div className="flex-1 min-w-0 sm:text-center">
                  <h2 className="font-bold text-base sm:text-lg leading-tight">
                    {localizedName}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mt-0.5">
                    {localizedDesc}
                  </p>

                  {/* Progress bar uses the world theme color */}
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-0"
                      role="progressbar"
                      aria-valuenow={stat.completed}
                      aria-valuemin={0}
                      aria-valuemax={stat.total}
                      aria-label={t("worlds.missions_aria", {
                        completed: stat.completed,
                        total: stat.total,
                      })}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width:
                            stat.total > 0
                              ? `${(stat.completed / stat.total) * 100}%`
                              : "0%",
                          backgroundColor: world.themeColor,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 shrink-0 tabular-nums">
                      {stat.completed}/{stat.total}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1.5 sm:justify-center text-[11px] font-medium text-slate-600">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="tabular-nums">
                      {stat.totalStars}/{stat.maxStars}
                    </span>
                  </div>
                </div>
              </button>

              {/* Connector to the next world. Hidden on the last node. */}
              {next && (
                <div
                  aria-hidden="true"
                  className="flex items-center justify-center self-center shrink-0 my-1 sm:my-0 sm:mx-1"
                >
                  <svg
                    width="44"
                    height="44"
                    viewBox="0 0 44 44"
                    className="rotate-90 sm:rotate-0"
                  >
                    <line
                      x1="6"
                      y1="22"
                      x2="38"
                      y2="22"
                      stroke={edgeActive ? world.themeColor : "#cbd5e1"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={edgeActive ? "0" : "4 4"}
                    />
                    <polyline
                      points="30,14 38,22 30,30"
                      fill="none"
                      stroke={edgeActive ? world.themeColor : "#cbd5e1"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
