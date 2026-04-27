"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProgressStore } from "@/store/progressStore";
import { goBackOr } from "@/lib/navigation";
import { loadContent, type ContentBundle } from "@/data/loader";
import MoleculePreview from "@/components/MoleculePreview";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import type { Discovery, Molecule } from "@/types";

// Notebook — reads the player's discovery history. Each discovery
// renders as a sticker-style card. When the discovery's underlying
// content is a known molecule (sandbox match, or a build-molecule
// mission target), the card shows a small Lewis-style preview of
// the structure on the left so the notebook becomes a visual
// portfolio of what the player has actually built — not just a list
// of titles. Other discovery kinds (run-reaction missions, build-atom
// missions, generic events) keep the original icon tile.
export default function NotebookPage() {
  const router = useRouter();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const discoveries = useProgressStore((s) => s.discoveries);
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<ContentBundle | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let cancelled = false;
    loadContent()
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch(() => {
        // Loading failure is non-fatal here — without content we just
        // fall back to the icon-tile rendering, which is still useful.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve each discovery to a molecule (or null) so the card knows
  // whether to render a structure preview. Memoized so we don't
  // recompute on every render — discoveries can be a long list and
  // each lookup walks the missions / molecules arrays.
  const moleculeByDiscoveryId = useMemo(() => {
    const map = new Map<string, Molecule>();
    if (!content) return map;
    for (const d of discoveries) {
      const m = resolveMolecule(d, content);
      if (m) map.set(d.id, m);
    }
    return map;
  }, [discoveries, content]);

  if (!mounted) return null;
  if (!currentProfile) {
    router.replace("/");
    return null;
  }

  return (
    <main className="flex-1 flex flex-col items-center px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
      <div className="w-full max-w-2xl">
        <button
          onClick={() => goBackOr(router, "/")}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-4 sm:mb-6 touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-7 h-7 text-sky-600" />
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            {currentProfile.name}&apos;s Notebook
          </h1>
        </div>
        <p className="text-sm sm:text-base text-slate-600 mb-6">
          Every chemistry thing you&apos;ve made shows up here.
        </p>

        {discoveries.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
            <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700 mb-1">
              No discoveries yet
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Finish a mission and your first sticker lands here.
            </p>
            <Link
              href="/worlds"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
            >
              Pick a mission
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {discoveries.map((d) => {
              const molecule = moleculeByDiscoveryId.get(d.id);
              return (
                <li
                  key={d.id}
                  className="flex items-start gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm"
                >
                  {molecule && content ? (
                    // Molecule tile — soft tinted background frames the
                    // structure so it reads as "what you built" rather
                    // than a UI affordance.
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 p-1">
                      <MoleculePreview
                        molecule={molecule}
                        elements={content.elements}
                        size={56}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      {d.kind === "mission-complete" ? (
                        <Sparkles className="w-5 h-5" />
                      ) : (
                        <BookOpen className="w-5 h-5" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-base leading-tight">
                      {d.label}
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {d.explanation}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 mt-1.5 uppercase tracking-wider">
                      {kindLabel(d.kind)} ·{" "}
                      {molecule ? `${molecule.formulaHill} · ` : ""}
                      {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "mission-complete":
      return "Mission";
    case "sandbox-molecule":
      return "Sandbox";
    case "first-element-built":
      return "Element";
    default:
      return "Discovery";
  }
}

// Resolve a discovery to its underlying molecule when one exists.
// Sandbox discoveries store the moleculeId directly in refId; mission
// discoveries store a missionId, so we look up the mission and take
// the first build-molecule success condition. Run-reaction missions
// and build-atom missions have no single molecule to preview, so
// they fall back to the icon tile.
function resolveMolecule(
  d: Discovery,
  content: ContentBundle
): Molecule | null {
  if (d.kind === "sandbox-molecule") {
    return content.molecules.find((m) => m.moleculeId === d.refId) ?? null;
  }
  if (d.kind === "mission-complete") {
    const mission = content.missions.find((m) => m.missionId === d.refId);
    if (!mission) return null;
    if (mission.objectiveType !== "build-molecule") return null;
    const buildCondition = mission.successConditions.find(
      (c) => c.type === "build-molecule"
    );
    const targetId =
      buildCondition && buildCondition.type === "build-molecule"
        ? buildCondition.targetMoleculeId
        : mission.allowedMolecules[0];
    if (!targetId) return null;
    return content.molecules.find((m) => m.moleculeId === targetId) ?? null;
  }
  return null;
}
