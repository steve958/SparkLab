"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react";
import { useProgressStore } from "@/store/progressStore";
import { goBackOr } from "@/lib/navigation";
import { loadContent, type ContentBundle } from "@/data/loader";
import type { BadgeDefinition } from "@/types";
import { Award, Lock, ArrowLeft } from "lucide-react";

// Collection page: every authored badge shown as earned (color +
// description) or locked (greyscale, hint of what unlocks it).
export default function BadgesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const earned = useProgressStore((s) => s.badges);
  const [content, setContent] = useState<ContentBundle | null>(null);

  useEffect(() => {
    if (!currentProfile) {
      router.replace("/");
      return;
    }
    loadContent().then(setContent).catch(() => {});
  }, [currentProfile, router]);

  if (!currentProfile || !content) return null;

  const earnedIds = new Set(earned.map((a) => a.badgeId));
  const total = content.badges.length;
  const earnedCount = content.badges.filter((b) => earnedIds.has(b.badgeId))
    .length;

  return (
    <main className="flex-1 flex flex-col items-center px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
      <div className="w-full max-w-2xl">
        <button
          onClick={() => goBackOr(router, "/")}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-4 sm:mb-6 touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          {t("menu.back")}
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Award className="w-7 h-7 text-amber-600" />
          <h1 className="text-2xl sm:text-3xl font-extrabold">{t("badges_page.title")}</h1>
        </div>
        <p className="text-sm sm:text-base text-slate-600 mb-6">
          {t("badges_page.summary", { earned: earnedCount, total })}
        </p>

        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {content.badges.map((def) => (
            <BadgeCard
              key={def.badgeId}
              def={def}
              earned={earnedIds.has(def.badgeId)}
            />
          ))}
        </ul>
      </div>
    </main>
  );
}

function BadgeCard({
  def,
  earned,
}: {
  def: BadgeDefinition;
  earned: boolean;
}) {
  // Resolve the icon by name from lucide-react. Fall back to Sparkles if
  // the authored name doesn't exist (defensive against typos in
  // badges.json).
  const IconComp =
    (Icons as unknown as Record<string, Icons.LucideIcon>)[def.icon] ??
    Icons.Sparkles;
  const color = earned ? (def.color ?? "#15803d") : "#cbd5e1";

  // Locked badges previously used `opacity-70` on the whole card, which
  // tanked text contrast below 4.5:1 for the description line. Instead
  // we keep text at full opacity and signal "locked" with the bg + icon.
  return (
    <li
      className={`relative rounded-2xl border-2 p-4 text-center transition-all ${
        earned
          ? "border-slate-200 bg-white shadow-sm"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      {!earned && (
        <Lock className="absolute top-2 right-2 w-3.5 h-3.5 text-slate-500" />
      )}
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mx-auto mb-2 flex items-center justify-center text-white"
        style={{ backgroundColor: color }}
      >
        <IconComp className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
      <h3
        className={`font-bold text-sm leading-tight ${
          earned ? "text-foreground" : "text-slate-700"
        }`}
      >
        {def.title}
      </h3>
      <p
        className={`text-[11px] sm:text-xs mt-1 line-clamp-3 ${
          earned ? "text-slate-600" : "text-slate-700"
        }`}
      >
        {def.description}
      </p>
    </li>
  );
}
