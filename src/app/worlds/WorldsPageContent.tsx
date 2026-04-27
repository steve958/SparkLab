"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadContent, type ContentBundle } from "@/data/loader";
import { useProgressStore } from "@/store/progressStore";
import { goBackOr } from "@/lib/navigation";
import MissionBrowser from "@/components/MissionBrowser";
import WorldMap from "@/components/WorldMap";
import AmbientAtoms from "@/components/AmbientAtoms";
import { ArrowLeft } from "lucide-react";

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
      router.replace("/");
      return;
    }
    loadContent()
      .then(setContent)
      .catch((e) => setError(e.message));
  }, [currentProfile, router]);

  if (!currentProfile) return null;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-4">
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
      <div className="flex flex-col items-center justify-center min-h-dvh">
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

  // Schematic world map. Per Phase 1 design decision Q2: clean schematic,
  // no illustrated art. Implementation in components/WorldMap.tsx. The
  // ambient atom layer sits behind the map for a faint chemistry-flavored
  // atmosphere — different seed than the LabHub layer so the two surfaces
  // have visually distinct distributions.
  return (
    <main className="flex-1 flex flex-col items-center px-3 sm:px-4 py-4 sm:py-6 sm:justify-center overflow-y-auto relative overflow-x-hidden">
      <AmbientAtoms count={14} seed={113} />
      <div className="relative z-10 w-full max-w-3xl">
        <button
          onClick={() => goBackOr(router, "/")}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-3 sm:mb-6 touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <WorldMap
          worlds={content.worlds}
          missions={content.missions}
          progress={progress}
        />
      </div>
    </main>
  );
}
