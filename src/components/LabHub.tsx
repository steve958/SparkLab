"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/store/progressStore";
import { useGameStore } from "@/store/gameStore";
import { loadContent, type ContentBundle } from "@/data/loader";
import {
  Play,
  Settings,
  Shield,
  Table,
  PenTool,
  Star,
  BookOpen,
  Award,
  Beaker,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import AvatarBadge from "./AvatarBadge";

// Replaces the old simple MainMenu with a richer dashboard. Schematic
// only (Phase 2 default): cards + theme colors, no illustrated room.
// As progress accumulates the stat strip and recent-discoveries pane
// "evolve" without needing artist work.
export default function LabHub() {
  const { t } = useTranslation();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const progress = useProgressStore((s) => s.progress);
  const discoveries = useProgressStore((s) => s.discoveries);
  const badges = useProgressStore((s) => s.badges);
  const isMissionUnlocked = useProgressStore((s) => s.isMissionUnlocked);
  const initMission = useGameStore((s) => s.initMission);

  const [content, setContent] = useState<ContentBundle | null>(null);
  useEffect(() => {
    loadContent().then(setContent).catch(() => {});
  }, []);

  const totalStars = progress.reduce((sum, p) => sum + p.stars, 0);
  const completedMissions = progress.filter((p) => p.stars > 0).length;

  // Current quest: first unlocked, not-yet-completed mission, scanning
  // worlds in their authored order. Null if everything is mastered.
  const currentQuest = useMemo(() => {
    if (!content) return null;
    for (const world of content.worlds) {
      const worldMissions = content.missions.filter(
        (m) => m.worldId === world.worldId
      );
      for (const mission of worldMissions) {
        if (!isMissionUnlocked(mission.missionId, mission.prerequisites))
          continue;
        const stars =
          progress.find((p) => p.missionId === mission.missionId)?.stars ?? 0;
        if (stars === 0) {
          return { world, mission };
        }
      }
    }
    return null;
  }, [content, progress, isMissionUnlocked]);

  const recentDiscoveries = discoveries.slice(0, 3);

  if (!currentProfile) return null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 sm:space-y-6">
      {/* Header. The welcome line uses the existing i18n key so test
          helpers and screen-readers see the same greeting as before. */}
      <div className="flex items-center gap-4">
        <AvatarBadge profile={currentProfile} size="xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary tracking-wide">
            {t("profile.welcome_back", { name: currentProfile.name })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground truncate">
            {currentProfile.name}&apos;s Lab
          </h1>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <Stat icon={<Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />} value={totalStars} label="Stars" />
        <Stat icon={<Sparkles className="w-4 h-4 text-primary" />} value={completedMissions} label="Missions" />
        <Stat icon={<BookOpen className="w-4 h-4 text-sky-600" />} value={discoveries.length} label="Discoveries" />
        <Stat icon={<Award className="w-4 h-4 text-amber-600" />} value={badges.length} label="Badges" />
      </div>

      {/* Current quest */}
      {currentQuest ? (
        <Link
          href="/game"
          onClick={() => initMission(currentQuest.mission)}
          className="block p-4 sm:p-5 rounded-2xl border-2 border-primary bg-white hover:shadow-md transition-all"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
            Current quest
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base sm:text-lg leading-tight truncate">
                {currentQuest.mission.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                {currentQuest.mission.brief}
              </p>
              <p
                className="text-[11px] font-semibold mt-1.5"
                style={{ color: currentQuest.world.themeColor }}
              >
                {currentQuest.world.name}
              </p>
            </div>
            <div className="flex items-center gap-1 text-primary font-semibold text-sm shrink-0">
              Play
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>
      ) : completedMissions > 0 ? (
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-green-200 bg-green-50/50 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-green-800">
            Master scientist
          </p>
          <p className="text-sm text-slate-700 mt-1">
            You&apos;ve cleared every mission. Try the sandbox to invent
            something new.
          </p>
        </div>
      ) : null}

      {/* Recent discoveries */}
      {recentDiscoveries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Latest discoveries
            </h3>
            <Link
              href="/notebook"
              className="text-xs font-medium text-primary hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="grid gap-2">
            {recentDiscoveries.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white"
              >
                <BookOpen className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{d.label}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {d.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
          Lab tools
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <ActionCard href="/worlds" icon={<Play className="w-5 h-5" />} label={t("menu.play")} primary />
          <ActionCard href="/sandbox" icon={<Beaker className="w-5 h-5" />} label="Sandbox" />
          <ActionCard href="/notebook" icon={<BookOpen className="w-5 h-5" />} label="Notebook" />
          <ActionCard href="/badges" icon={<Award className="w-5 h-5" />} label="Badges" />
          <ActionCard href="/periodic-table" icon={<Table className="w-5 h-5" />} label={t("periodic_table.title")} />
          <ActionCard href="/settings" icon={<Settings className="w-5 h-5" />} label={t("menu.settings")} />
          <ActionCard href="/cms" icon={<PenTool className="w-5 h-5" />} label={t("cms.title")} />
          <ActionCard href="/dashboard" icon={<Shield className="w-5 h-5" />} label={t("menu.dashboard")} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <span className="font-bold text-base sm:text-lg tabular-nums">
          {value}
        </span>
      </div>
      <p className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase tracking-wider mt-0.5">
        {label}
      </p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-xl border-2 font-semibold text-sm transition-all touch-target-lg ${
        primary
          ? "border-primary bg-primary text-white hover:bg-primary-hover"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {icon}
      <span className="text-center text-[13px] sm:text-sm leading-tight">
        {label}
      </span>
    </Link>
  );
}
