"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/store/progressStore";
import { exportAllData, deleteAllData } from "@/lib/db";
import {
  createParentAccount,
  verifyParentLogin,
  hasAnyParentAccount,
  validatePassword,
  validateEmail,
} from "@/lib/parent-auth";
import {
  getEventsForProfile,
  clearTelemetryForProfile,
  TELEMETRY_RETENTION_MS,
} from "@/lib/telemetry";
import { goBackOr } from "@/lib/navigation";
import {
  Shield,
  ArrowLeft,
  Download,
  Trash2,
  Users,
  BookOpen,
  ShieldCheck,
  LogOut,
  Activity,
} from "lucide-react";
import AvatarBadge from "@/components/AvatarBadge";
import type { TelemetryEvent } from "@/types";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const adultSession = useProgressStore((s) => s.adultSession);
  const setAdultSession = useProgressStore((s) => s.setAdultSession);
  const profiles = useProgressStore((s) => s.profiles);
  const progress = useProgressStore((s) => s.progress);

  const sessionLive =
    !!adultSession && adultSession.expiresAt > Date.now() && !!adultSession.email;

  if (!sessionLive) {
    return (
      <ParentAuthGate
        onAuthed={(email) => {
          setAdultSession({
            type: "parent",
            email,
            createdAt: Date.now(),
            expiresAt: Date.now() + SESSION_TTL_MS,
          });
        }}
      />
    );
  }

  return (
    <DashboardSignedIn
      profiles={profiles}
      progress={progress}
      onSignOut={() => setAdultSession(null)}
      onExport={async () => {
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
      }}
      onDelete={async () => {
        await deleteAllData();
        setAdultSession(null);
        // Hard reload because we just wiped IndexedDB.
        window.location.href = "/";
      }}
      goBack={() => goBackOr(router, "/")}
      t={t}
    />
  );
}

function ParentAuthGate({
  onAuthed,
}: {
  onAuthed: (email: string) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"checking" | "create" | "signin">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Decide between "create the first parent account" and "sign in" by
  // peeking at the parents table on mount.
  useEffect(() => {
    let cancelled = false;
    hasAnyParentAccount().then((exists) => {
      if (cancelled) return;
      setMode(exists ? "signin" : "create");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateEmail(email)) {
      setError(t("dashboard.invalid_email"));
      return;
    }
    setPending(true);
    try {
      if (mode === "create") {
        const policy = validatePassword(password);
        if (!policy.ok) {
          setError(policy.reasons.join(" "));
          setPending(false);
          return;
        }
        await createParentAccount(email, password);
        onAuthed(email.trim().toLowerCase());
      } else {
        const account = await verifyParentLogin(email, password);
        if (!account) {
          setError(t("dashboard.wrong_credentials"));
          setPending(false);
          return;
        }
        onAuthed(account.email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.generic_error"));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      <button
        onClick={() => goBackOr(router, "/")}
        className="absolute top-4 left-4 flex items-center gap-2 text-slate-500 hover:text-foreground touch-target"
      >
        <ArrowLeft className="w-5 h-5" />
        {t("menu.back")}
      </button>

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-6 mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">
          {t("dashboard.title")}
        </h1>
        <p className="text-slate-600 text-center mb-6">
          {mode === "create"
            ? t("dashboard.create_account_intro")
            : mode === "signin"
              ? t("dashboard.signin_intro")
              : t("dashboard.loading_intro")}
        </p>

        {mode !== "checking" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {t("dashboard.email_label")}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                autoComplete={mode === "create" ? "email" : "username"}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
                required
                autoFocus
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {t("dashboard.password_label")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete={
                  mode === "create" ? "new-password" : "current-password"
                }
                minLength={8}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
                required
              />
              {mode === "create" && (
                <span className="block text-xs text-slate-600 mt-1">
                  {t("dashboard.password_hint")}
                </span>
              )}
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {mode === "create" ? t("dashboard.create_account_btn") : t("dashboard.signin_btn")}
            </button>
            <p className="text-xs text-slate-600 text-center mt-2">
              {t("dashboard.all_local")}{" "}
              <Link
                href="/privacy"
                className="text-primary underline hover:no-underline"
              >
                {t("dashboard.privacy_link")}
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

function DashboardSignedIn({
  profiles,
  progress,
  onSignOut,
  onExport,
  onDelete,
  goBack,
  t,
}: {
  profiles: ReturnType<typeof useProgressStore.getState>["profiles"];
  progress: ReturnType<typeof useProgressStore.getState>["progress"];
  onSignOut: () => void;
  onExport: () => Promise<void>;
  onDelete: () => Promise<void>;
  goBack: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const adultSession = useProgressStore((s) => s.adultSession);
  const removeProfile = useProgressStore((s) => s.removeProfile);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [confirmPending, setConfirmPending] = useState(false);
  // Per-profile delete: holds the profile id awaiting password challenge
  // (null when no profile-delete is active).
  const [profileDeleteId, setProfileDeleteId] = useState<string | null>(null);

  const confirmAndDelete = async () => {
    if (!adultSession?.email) return;
    setConfirmError("");
    setConfirmPending(true);
    const ok = await verifyParentLogin(adultSession.email, confirmPassword);
    setConfirmPending(false);
    if (!ok) {
      setConfirmError(t("dashboard.wrong_password"));
      return;
    }
    if (profileDeleteId) {
      await removeProfile(profileDeleteId);
      setProfileDeleteId(null);
      setConfirmPassword("");
      return;
    }
    await onDelete();
  };

  const profileBeingDeleted = profileDeleteId
    ? profiles.find((p) => p.id === profileDeleteId)
    : null;

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full p-4">
      <div className="flex items-center justify-between mb-6 gap-2">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          {t("menu.back")}
        </button>
        <h1 className="text-2xl font-bold flex-1 text-center">
          {t("dashboard.title")}
        </h1>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-foreground touch-target"
          aria-label={t("menu.sign_out")}
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{t("menu.sign_out")}</span>
        </button>
      </div>

      {adultSession?.email && (
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-600">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>{t("dashboard.signed_in_as", { email: adultSession.email })}</span>
        </div>
      )}

      {/* Profiles */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          {t("dashboard.profiles")}
        </h2>
        {profiles.length === 0 ? (
          <p className="text-slate-600">{t("dashboard.no_profiles")}</p>
        ) : (
          <div className="grid gap-3">
            {profiles.map((profile) => {
              const profileProgress = progress.filter(
                (p) => p.profileId === profile.id
              );
              const completed = profileProgress.filter((p) => p.completedAt)
                .length;
              const totalStars = profileProgress.reduce(
                (s, p) => s + p.stars,
                0
              );

              return (
                <div
                  key={profile.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarBadge profile={profile} size="md" />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {profile.name}
                        </div>
                        <div className="text-sm text-slate-600">
                          {t("dashboard.age_label", { ageBand: profile.ageBand })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-sm text-slate-600">
                        <div>{t("dashboard.missions_short", { count: completed })}</div>
                        <div>{t("dashboard.stars_short", { count: totalStars })}</div>
                      </div>
                      <button
                        onClick={() => {
                          setProfileDeleteId(profile.id);
                          setConfirmPassword("");
                          setConfirmError("");
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-700 transition-colors"
                        aria-label={t("dashboard.delete_profile_aria", { name: profile.name })}
                        title={t("dashboard.delete_profile_aria", { name: profile.name })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent activity (telemetry summary, last 7 days). Read-only +
          per-profile clear. Privacy-reviewed event schema. */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          {t("dashboard.recent_activity")}
        </h2>
        {profiles.length === 0 ? (
          <p className="text-slate-600">{t("dashboard.no_profiles")}</p>
        ) : (
          <div className="grid gap-3">
            {profiles.map((p) => (
              <ProfileActivityCard key={p.id} profileId={p.id} name={p.name} />
            ))}
          </div>
        )}
        <p className="text-xs text-slate-600 mt-3">
          {t("dashboard.telemetry_retention", {
            days: Math.round(TELEMETRY_RETENTION_MS / (24 * 60 * 60 * 1000)),
          })}
        </p>
      </section>

      {/* Data management */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          {t("dashboard.data_management")}
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors touch-target-lg"
          >
            <Download className="w-5 h-5" />
            {t("dashboard.export")}
          </button>
          <button
            onClick={() => {
              setConfirmPassword("");
              setConfirmError("");
              setShowDeleteConfirm(true);
            }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors touch-target-lg"
          >
            <Trash2 className="w-5 h-5" />
            {t("dashboard.delete")}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-3">
          {t("dashboard.data_management_desc")}
        </p>
      </section>

      {/* Profile-activity card extracted as a child so each row can
          load its own events without making the dashboard component
          monolithic. Implementation lives at the bottom of this file. */}

      {/* Per-profile delete confirmation. Same password-challenge as
          the global delete; on success calls progressStore.removeProfile
          which cleans every per-profile table. */}
      {profileBeingDeleted && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-delete-title"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 id="profile-delete-title" className="text-xl font-bold mb-2">
              {t("dashboard.delete_profile_title", { name: profileBeingDeleted.name })}
            </h3>
            <p className="text-slate-600 mb-4">
              {t("dashboard.delete_profile_text")}
            </p>
            <label className="block mb-3">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {t("dashboard.reenter_password")}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError("");
                }}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
                autoFocus
              />
            </label>
            {confirmError && (
              <p role="alert" className="text-sm text-red-700 mb-3">
                {confirmError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setProfileDeleteId(null);
                  setConfirmPassword("");
                  setConfirmError("");
                }}
                className="flex-1 py-3 rounded-xl border border-slate-300 font-medium hover:bg-slate-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={confirmAndDelete}
                disabled={!confirmPassword || confirmPending}
                className="flex-1 py-3 rounded-xl bg-red-700 text-white font-medium hover:bg-red-800 disabled:opacity-50 transition-colors"
              >
                {t("dashboard.delete_profile_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — re-prompts the parent password before
          actually wiping IndexedDB. */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 id="delete-title" className="text-xl font-bold mb-2">
              {t("dashboard.delete_confirm_title")}
            </h3>
            <p className="text-slate-600 mb-4">
              {t("dashboard.delete_confirm_text")}
            </p>
            <label className="block mb-3">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {t("dashboard.reenter_password")}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError("");
                }}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
                autoFocus
              />
            </label>
            {confirmError && (
              <p role="alert" className="text-sm text-red-700 mb-3">
                {confirmError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-300 font-medium hover:bg-slate-50 transition-colors"
              >
                {t("dashboard.delete_cancel")}
              </button>
              <button
                onClick={confirmAndDelete}
                disabled={!confirmPassword || confirmPending}
                className="flex-1 py-3 rounded-xl bg-red-700 text-white font-medium hover:bg-red-800 disabled:opacity-50 transition-colors"
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function ProfileActivityCard({
  profileId,
  name,
}: {
  profileId: string;
  name: string;
}) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<TelemetryEvent[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getEventsForProfile(profileId, Date.now() - SEVEN_DAYS_MS).then(
      (data) => {
        if (!cancelled) setEvents(data);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [profileId, reloadKey]);

  const summary = useMemo(() => {
    if (!events) return null;
    const counts = {
      mission_start: 0,
      mission_complete: 0,
      hint_used: 0,
      mastery_check: 0,
      sandbox_save: 0,
    };
    for (const e of events) counts[e.kind]++;
    return counts;
  }, [events]);

  const handleClear = async () => {
    await clearTelemetryForProfile(profileId);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-sm text-foreground truncate">
          {name}
        </p>
        <button
          onClick={handleClear}
          disabled={events?.length === 0}
          className="text-xs font-medium text-slate-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("dashboard.clear_activity")}
        </button>
      </div>
      {!summary ? (
        <p className="text-xs text-slate-500">{t("common.loading_short")}</p>
      ) : events && events.length === 0 ? (
        <p className="text-xs text-slate-600">
          {t("dashboard.no_recent_activity")}
        </p>
      ) : (
        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <ActivityStat label={t("dashboard.activity_started")} value={summary.mission_start} />
          <ActivityStat label={t("dashboard.activity_completed")} value={summary.mission_complete} />
          <ActivityStat label={t("dashboard.activity_hints")} value={summary.hint_used} />
          <ActivityStat label={t("dashboard.activity_quizlets")} value={summary.mastery_check} />
          <ActivityStat label={t("dashboard.activity_sandbox")} value={summary.sandbox_save} />
        </dl>
      )}
    </div>
  );
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
      <dt className="text-[10px] uppercase tracking-wider text-slate-600">
        {label}
      </dt>
      <dd className="font-bold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
