"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProgressStore } from "@/store/progressStore";
import { goBackOr } from "@/lib/navigation";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";

// Notebook — reads the player's discovery history. Each discovery is
// rendered as a sticker-style card with the thing they made and a one-
// line explanation captured at write time. Empty state nudges to /worlds.
export default function NotebookPage() {
  const router = useRouter();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const discoveries = useProgressStore((s) => s.discoveries);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
            {discoveries.map((d) => (
              <li
                key={d.id}
                className="flex items-start gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  {d.kind === "mission-complete" ? (
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    <BookOpen className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base leading-tight">
                    {d.label}
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {d.explanation}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 mt-1.5 uppercase tracking-wider">
                    {kindLabel(d.kind)} ·{" "}
                    {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
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
