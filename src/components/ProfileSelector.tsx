"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/store/progressStore";
import type { PlayerProfile, AgeBand } from "@/types";
import { UserPlus, Trash2, ArrowRight } from "lucide-react";

export default function ProfileSelector() {
  const { t } = useTranslation();
  const profiles = useProgressStore((s) => s.profiles);
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const setCurrentProfile = useProgressStore((s) => s.setCurrentProfile);
  const addProfile = useProgressStore((s) => s.addProfile);
  const removeProfile = useProgressStore((s) => s.removeProfile);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand>("8-10");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const profile: PlayerProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      avatar: "default",
      createdAt: Date.now(),
      ageBand,
    };
    await addProfile(profile);
    setCurrentProfile(profile);
    setShowCreate(false);
    setName("");
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">{t("profile.title")}</h2>

      <div className="grid gap-3 mb-6">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all touch-target-lg ${
              currentProfile?.id === profile.id
                ? "border-primary bg-sky-50"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <button
              onClick={() => setCurrentProfile(profile)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">{profile.name}</div>
                <div className="text-sm text-slate-500">
                  {t("profile.age")} {profile.ageBand}
                </div>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {currentProfile?.id === profile.id && (
                <ArrowRight className="w-5 h-5 text-primary" />
              )}
              <button
                onClick={() => removeProfile(profile.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                aria-label={`${t("profile.delete")} ${profile.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-primary hover:bg-sky-50 transition-all touch-target-lg text-slate-600 hover:text-primary"
        >
          <UserPlus className="w-5 h-5" />
          <span className="font-medium">{t("profile.new")}</span>
        </button>
      ) : (
        <div className="p-4 rounded-xl border-2 border-primary bg-sky-50">
          <label className="block text-sm font-medium mb-2">
            {t("profile.name_placeholder")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("profile.name_placeholder")}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
            maxLength={20}
            autoFocus
          />
          <label className="block text-sm font-medium mt-4 mb-2">
            {t("profile.age")}
          </label>
          <div className="flex gap-2">
            {(["8-10", "11-14"] as AgeBand[]).map((band) => (
              <button
                key={band}
                onClick={() => setAgeBand(band)}
                className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                  ageBand === band
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {band}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 font-medium transition-colors"
            >
              {t("profile.cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="flex-1 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("profile.create")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
