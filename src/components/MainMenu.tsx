"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/store/progressStore";
import { Play, Settings, Shield, Table, PenTool, Star } from "lucide-react";
import AvatarBadge from "./AvatarBadge";

export default function MainMenu() {
  const { t } = useTranslation();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const progress = useProgressStore((s) => s.progress);
  const totalStars = progress.reduce((sum, p) => sum + p.stars, 0);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center">
        <Image
          src="/icons/sparklab-logo.png"
          alt="SparkLab"
          width={112}
          height={112}
          priority
          className="mx-auto mb-4 w-20 h-20 sm:w-28 sm:h-28"
        />
        <h1 className="text-4xl font-extrabold text-foreground mb-2">
          {t("app.name")}
        </h1>
        <p className="text-lg text-slate-600">{t("app.tagline")}</p>
      </div>

      {currentProfile && (
        <div className="flex flex-col items-center text-center gap-2">
          <AvatarBadge profile={currentProfile} size="xl" />
          <p className="text-slate-500">
            {t("profile.welcome_back", { name: currentProfile.name })}
          </p>
          {totalStars > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-yellow-600 font-semibold">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span>{totalStars} stars earned</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/worlds"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary-hover transition-colors touch-target-lg"
        >
          <Play className="w-6 h-6" />
          {t("menu.play")}
        </Link>

        <Link
          href="/periodic-table"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-white border-2 border-slate-200 text-foreground font-semibold text-lg hover:border-slate-300 transition-colors touch-target-lg"
        >
          <Table className="w-6 h-6" />
          {t("periodic_table.title")}
        </Link>

        <Link
          href="/settings"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-white border-2 border-slate-200 text-foreground font-semibold text-lg hover:border-slate-300 transition-colors touch-target-lg"
        >
          <Settings className="w-6 h-6" />
          {t("menu.settings")}
        </Link>

        <Link
          href="/cms"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-white border-2 border-slate-200 text-foreground font-semibold text-lg hover:border-slate-300 transition-colors touch-target-lg"
        >
          <PenTool className="w-6 h-6" />
          {t("cms.title")}
        </Link>

        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-white border-2 border-slate-200 text-foreground font-semibold text-lg hover:border-slate-300 transition-colors touch-target-lg"
        >
          <Shield className="w-6 h-6" />
          {t("menu.dashboard")}
        </Link>
      </div>
    </div>
  );
}
