"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { goBackOr } from "@/lib/navigation";
import { ArrowLeft, ShieldCheck, User, Sparkles } from "lucide-react";

// Privacy notice — two views on one route. Default is the kid view
// (short, age-appropriate). A "For grown-ups" toggle flips to the
// parent view with the detailed disclosures.
//
// Both views are intentionally hand-written (not loaded from i18n)
// because the wording is the legally meaningful artifact. When the
// privacy advisor signs off in Phase 3+, those exact strings replace
// what's here. Strings are NOT placeholders — they're the current best
// description of actual data handling, but external review is pending
// per [compliance/posture.md](../../compliance/posture.md).

type View = "kid" | "parent";

export default function PrivacyPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("kid");

  return (
    <main className="flex-1 px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto">
        <button
          onClick={() => goBackOr(router, "/")}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground mb-4 sm:mb-6 touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {/* View toggle */}
        <div className="flex items-center gap-2 mb-6 p-1 rounded-xl bg-slate-100 w-fit">
          <button
            onClick={() => setView("kid")}
            aria-pressed={view === "kid"}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === "kid" ? "bg-white text-foreground shadow-sm" : "text-slate-600"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            For kids
          </button>
          <button
            onClick={() => setView("parent")}
            aria-pressed={view === "parent"}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === "parent" ? "bg-white text-foreground shadow-sm" : "text-slate-600"
            }`}
          >
            <User className="w-4 h-4" />
            For grown-ups
          </button>
        </div>

        {view === "kid" ? <KidView /> : <ParentView />}
      </div>
    </main>
  );
}

function KidView() {
  return (
    <article className="max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-sm [&_p]:sm:text-base [&_p]:text-slate-700 [&_p]:leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-sm [&_ul]:sm:text-base [&_ul]:text-slate-700 [&_ul]:space-y-1.5 [&_ul]:mb-4 [&_li]:leading-relaxed [&_strong]:text-foreground">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-extrabold m-0">
          What SparkLab knows about you
        </h1>
      </div>
      <p className="text-base sm:text-lg text-slate-700 mt-4 leading-relaxed">
        Hi! Here&apos;s the deal — SparkLab only remembers things that help
        you keep playing. Nothing fancy.
      </p>

      <ul className="list-none p-0 mt-6 space-y-3">
        <KidPoint
          title="Your name and your lab badge"
          body="The name you typed in and the color and accessory you picked. Just so we can say hi when you come back."
        />
        <KidPoint
          title="Which missions you finished"
          body="So you don't have to start over every time."
        />
        <KidPoint
          title="What you discovered"
          body="Every molecule you build shows up in your notebook."
        />
        <KidPoint
          title="That's it. Really."
          body="No ads. No tracking. We never share what you do."
        />
      </ul>

      <p className="mt-8 p-4 rounded-xl bg-sky-50 border border-sky-200 text-sm text-sky-900">
        <strong>A grown-up can delete everything any time.</strong> If you
        want to wipe your stuff and start fresh, ask a parent — they have
        a button for that.
      </p>
    </article>
  );
}

function KidPoint({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-3 items-start p-3 rounded-xl border border-slate-200 bg-white list-none">
      <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="font-bold text-foreground m-0">{title}</p>
        <p className="text-sm text-slate-700 mt-0.5 m-0">{body}</p>
      </div>
    </li>
  );
}

function ParentView() {
  return (
    <article className="max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-sm [&_p]:sm:text-base [&_p]:text-slate-700 [&_p]:leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-sm [&_ul]:sm:text-base [&_ul]:text-slate-700 [&_ul]:space-y-1.5 [&_ul]:mb-4 [&_li]:leading-relaxed [&_strong]:text-foreground">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-extrabold m-0">
          Privacy notice
        </h1>
      </div>
      <p className="text-sm text-slate-500 mt-1">
        Working version — pending external legal review. Last updated 2026-04-26.
      </p>

      <h2 className="mt-6">What SparkLab is</h2>
      <p>
        SparkLab is an interactive chemistry learning game intended for
        children ages 8–14. We treat it as a service directed to children
        and design accordingly under U.S. COPPA and the UK Children&apos;s
        Code.
      </p>

      <h2 className="mt-6">What we collect from a child</h2>
      <ul>
        <li>
          <strong>Display name</strong> (free-form text the child enters at
          profile creation). Stored locally only. We recommend not entering
          a real name.
        </li>
        <li><strong>Avatar customization</strong> (color + accessory choice).</li>
        <li><strong>Age band</strong> (8–10 or 11–14) to select the right curriculum.</li>
        <li><strong>Mission progress</strong> — stars, attempt counts, completion timestamps, hint usage, mastery quiz answers.</li>
        <li><strong>Discoveries</strong> — labels of molecules and atoms the child has built.</li>
        <li><strong>Telemetry events</strong> — predefined event types (mission start/complete, hint use, mastery checks). No free-text. Stored locally only.</li>
      </ul>

      <h2 className="mt-6">What we do not collect</h2>
      <ul>
        <li>Real names, birthdates, addresses, phone numbers, photos, or voice from a child.</li>
        <li>Any identifier from third-party advertising or analytics SDKs — we don&apos;t use any.</li>
        <li>Anything from a child profile that crosses the local-device boundary. There is no cloud sync in this version.</li>
      </ul>

      <h2 className="mt-6">Where it&apos;s stored</h2>
      <p>
        On the child&apos;s device, in IndexedDB and localStorage. Clearing
        the browser&apos;s site data also clears SparkLab data. The
        <em> Delete all data </em> button in the parent dashboard removes
        everything immediately.
      </p>

      <h2 className="mt-6">How long we keep it</h2>
      <ul>
        <li><strong>Profile + progress data:</strong> until you delete it.</li>
        <li><strong>Telemetry events:</strong> rolling 90-day window. Oldest events are dropped automatically. You can clear immediately.</li>
        <li><strong>Saved scenes (autosave):</strong> only the active mission&apos;s scene; replaced on next save.</li>
      </ul>

      <h2 className="mt-6">Parent controls</h2>
      <ul>
        <li>The parent dashboard requires email + password to enter (replaces the previous PIN).</li>
        <li>You can view, rename, or delete any child profile.</li>
        <li>You can export all data as a JSON file.</li>
        <li>You can delete all data (irreversibly) with a password challenge.</li>
      </ul>

      <h2 className="mt-6">No advertising or behavioral tracking</h2>
      <p>
        SparkLab does not show ads, run advertising SDKs, or share data
        with advertising networks. This is a hard rule in the codebase, not
        a default that could change silently.
      </p>

      <h2 className="mt-6">Pending external review</h2>
      <p>
        This document and the related controls are a working baseline.
        Items pending an external privacy/legal advisor sign-off:
        operator entity and contact information, final retention windows,
        the precise child-facing copy reading level, and any future cloud
        sync or teacher-mode features. Until that review concludes, the
        local-only architecture above is the practical privacy guarantee.
      </p>

      <h2 className="mt-6">Changes</h2>
      <p>
        When we change this notice, we update the date at the top and bump
        the version. There&apos;s no remote update mechanism — you&apos;ll
        see new wording the next time the app loads.
      </p>
    </article>
  );
}
