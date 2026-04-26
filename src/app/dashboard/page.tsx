"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/store/progressStore";
import { exportAllData, deleteAllData } from "@/lib/db";
import { goBackOr } from "@/lib/navigation";
import { Shield, ArrowLeft, Download, Trash2, Users, BookOpen } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const adultSession = useProgressStore((s) => s.adultSession);
  const setAdultSession = useProgressStore((s) => s.setAdultSession);
  const profiles = useProgressStore((s) => s.profiles);
  const progress = useProgressStore((s) => s.progress);

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const CORRECT_PIN = "1234"; // MVP only; real auth deferred

  const handleLogin = () => {
    if (pin === CORRECT_PIN) {
      const session = {
        type: "parent" as const,
        pin,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 min
      };
      setAdultSession(session);
      setError("");
    } else {
      setError("Incorrect PIN. Try again.");
    }
  };

  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparklab-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    await deleteAllData();
    setShowDeleteConfirm(false);
    setAdultSession(null);
    window.location.href = "/";
  };

  if (!adultSession || adultSession.expiresAt < Date.now()) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <button
          onClick={() => goBackOr(router, "/")}
          className="absolute top-4 left-4 flex items-center gap-2 text-slate-500 hover:text-foreground touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-6 mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">
            Grown-up Dashboard
          </h1>
          <p className="text-slate-600 text-center mb-6">
            Enter the PIN to manage player profiles and data.
          </p>

          <div className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              placeholder="Enter 4-digit PIN"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-center text-2xl tracking-widest focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
              autoFocus
            />
            {error && (
              <p className="text-error text-sm text-center">{error}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={pin.length !== 4}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              Enter
            </button>
            <p className="text-xs text-slate-600 text-center">
              MVP PIN: 1234
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full p-4">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => goBackOr(router, "/")}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <div className="w-8" />
      </div>

      {/* Profiles */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          {t("dashboard.profiles")}
        </h2>
        {profiles.length === 0 ? (
          <p className="text-slate-500">{t("dashboard.no_profiles")}</p>
        ) : (
          <div className="grid gap-3">
            {profiles.map((profile) => {
              const profileProgress = progress.filter(
                (p) => p.profileId === profile.id
              );
              const completed = profileProgress.filter((p) => p.completedAt).length;
              const totalStars = profileProgress.reduce((s, p) => s + p.stars, 0);

              return (
                <div
                  key={profile.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{profile.name}</div>
                        <div className="text-sm text-slate-500">
                          Age {profile.ageBand}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <div>{completed} missions completed</div>
                      <div>{totalStars} stars earned</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Data management */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          {t("dashboard.data_management")}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors touch-target-lg"
          >
            <Download className="w-5 h-5" />
            {t("dashboard.export")}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors touch-target-lg"
          >
            <Trash2 className="w-5 h-5" />
            {t("dashboard.delete")}
          </button>
        </div>
      </section>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-2">{t("dashboard.delete_confirm_title")}</h3>
            <p className="text-slate-600 mb-6">
              {t("dashboard.delete_confirm_text")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-300 font-medium hover:bg-slate-50 transition-colors"
              >
                {t("dashboard.delete_cancel")}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                {t("dashboard.delete_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
