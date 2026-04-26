"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/store/progressStore";
import { saveSettings } from "@/lib/db";
import { audio } from "@/lib/audio";
import { goBackOr } from "@/lib/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Monitor,
  Eye,
  Globe,
  ShieldCheck,
} from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const settings = useProgressStore((s) => s.settings);
  const updateSettings = useProgressStore((s) => s.updateSettings);

  const toggleSetting = async (
    key: "reducedMotion" | "soundEnabled" | "highContrast"
  ) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: !settings[key] };
    await saveSettings(newSettings);
    updateSettings(newSettings);
    if (key === "soundEnabled") audio.setEnabled(newSettings.soundEnabled);
    if (key === "reducedMotion") audio.setReducedMotion(newSettings.reducedMotion);
  };

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    if (settings) {
      const newSettings = { ...settings, language: lang };
      await saveSettings(newSettings);
      updateSettings(newSettings);
    }
  };

  return (
    <main className="flex-1 max-w-md mx-auto w-full p-4">
      <button
        onClick={() => goBackOr(router, "/")}
        className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-6 touch-target"
      >
        <ArrowLeft className="w-5 h-5" />
        {t("menu.back")}
      </button>

      <h1 className="text-3xl font-bold mb-2">{t("settings.title")}</h1>
      <p className="text-slate-600 mb-8">{t("settings.subtitle")}</p>

      {!currentProfile && (
        <p className="text-slate-500">{t("settings.no_profile")}</p>
      )}

      <div className="space-y-4">
        {/* Sound */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            {settings?.soundEnabled !== false ? (
              <Volume2 className="w-5 h-5 text-primary" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <div className="font-medium">{t("settings.sound")}</div>
              <div className="text-sm text-slate-500">
                {t("settings.sound_desc")}
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSetting("soundEnabled")}
            disabled={!settings}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              settings?.soundEnabled !== false
                ? "bg-primary"
                : "bg-slate-300"
            } disabled:opacity-50`}
            aria-label={t("settings.sound")}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings?.soundEnabled !== false ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">{t("settings.reduced_motion")}</div>
              <div className="text-sm text-slate-500">
                {t("settings.reduced_motion_desc")}
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSetting("reducedMotion")}
            disabled={!settings}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              settings?.reducedMotion ? "bg-primary" : "bg-slate-300"
            } disabled:opacity-50`}
            aria-label={t("settings.reduced_motion")}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings?.reducedMotion ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">{t("settings.high_contrast")}</div>
              <div className="text-sm text-slate-500">
                {t("settings.high_contrast_desc")}
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSetting("highContrast")}
            disabled={!settings}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              settings?.highContrast ? "bg-primary" : "bg-slate-300"
            } disabled:opacity-50`}
            aria-label={t("settings.high_contrast")}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings?.highContrast ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {/* Language */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">{t("settings.language")}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`py-2.5 rounded-lg border-2 font-medium transition-all ${
                  i18n.language === lang.code
                    ? "border-primary bg-sky-50 text-primary"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy notice link — both kid and parent views live at /privacy. */}
        <Link
          href="/privacy"
          className="flex items-center gap-3 mt-3 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-300 transition-colors touch-target-lg"
        >
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">Privacy notice</div>
            <div className="text-sm text-slate-600">
              What SparkLab knows about you (and what it doesn&apos;t).
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
