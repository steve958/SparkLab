"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadContent, type ContentBundle } from "@/data/loader";
import { useProgressStore } from "@/store/progressStore";
import MissionBrowser from "@/components/MissionBrowser";
import { ArrowLeft, Star, FlaskConical, FlaskRound, Flame } from "lucide-react";

const WORLD_ICON: Record<string, typeof FlaskConical> = {
  foundations: FlaskRound,
  core: FlaskConical,
  reactions: Flame,
};

export default function WorldsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedWorld = searchParams.get("world");
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const progress = useProgressStore((s) => s.progress);

  const [content, setContent] = useState<ContentBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProfile) {
      router.push("/");
      return;
    }
    loadContent()
      .then(setContent)
      .catch((e) => setError(e.message));
  }, [currentProfile, router]);

  if (!currentProfile) return null;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-red-600">Failed to load content: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show mission browser if world is selected
  if (selectedWorld) {
    return (
      <main className="flex-1">
        <MissionBrowser content={content} worldId={selectedWorld} />
      </main>
    );
  }

  // Show world selection. Top-aligned + scrollable so the page never clips
  // when the worlds list grows taller than the viewport (e.g. small phones).
  return (
    <main className="flex-1 flex flex-col items-center px-3 sm:px-4 py-4 sm:py-6 sm:justify-center overflow-y-auto">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-3 sm:mb-6 touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-1 sm:mb-2">Choose a World</h1>
        <p className="text-slate-600 text-center text-sm sm:text-base mb-4 sm:mb-8">
          Pick where you want to explore
        </p>

        <div className="grid gap-3 sm:gap-4">
          {content.worlds.map((world) => {
            // MVP: all worlds are unlocked; mission-level gating is the primary progression
            const isUnlocked = true;
            const worldMissions = content.missions.filter(
              (m) => m.worldId === world.worldId
            );
            const worldProgress = progress.filter((p) =>
              worldMissions.some((m) => m.missionId === p.missionId)
            );
            const completedCount = worldProgress.filter((p) => p.stars > 0).length;
            const totalStars = worldProgress.reduce((sum, p) => sum + p.stars, 0);
            const maxStars = worldMissions.length * 3;
            const progressPercent =
              worldMissions.length > 0
                ? Math.round((completedCount / worldMissions.length) * 100)
                : 0;

            return (
              <button
                key={world.worldId}
                onClick={() =>
                  isUnlocked && router.push(`/worlds?world=${world.worldId}`)
                }
                disabled={!isUnlocked}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-5 rounded-xl border-2 text-left transition-all ${
                  isUnlocked
                    ? "border-slate-200 bg-white hover:border-primary hover:shadow-md"
                    : "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                }`}
              >
                <div
                  className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: world.themeColor }}
                >
                  {(() => {
                    const Icon = WORLD_ICON[world.worldId] ?? FlaskConical;
                    return <Icon className="w-6 h-6 sm:w-7 sm:h-7" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base sm:text-lg leading-tight">{world.name}</h2>
                  <p className="text-xs sm:text-sm text-slate-500 line-clamp-2">{world.description}</p>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                    {/* Progress bar */}
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-0">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: world.themeColor,
                        }}
                      />
                    </div>
                    <span className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-slate-500 shrink-0">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {totalStars}/{maxStars}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
