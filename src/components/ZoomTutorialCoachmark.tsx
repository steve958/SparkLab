"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";

// Floating card in the canvas corner that loops a small "zoom in
// reveals the inner workings" demo. The Bohr nucleus + electron-shell
// + bond electron-flow visuals are gated on a zoom threshold and easy
// to miss without a nudge — the interaction-hint banner has a text
// reminder, but a moving preview lands the idea faster for kids who
// don't read every line.
//
// Stays visible until the player either taps X or actually zooms in
// past the threshold (at which point the hint has done its job and we
// auto-dismiss). No time-based auto-dismiss — earlier 14s timer caused
// the card to disappear before kids had time to read it, and Fast
// Refresh in dev was resetting state mid-timer. Dismissed state is
// stored in localStorage so returning players don't see it again.

const STORAGE_KEY = "sparklab_zoom_tutorial_dismissed";
const ZOOM_DISMISS_THRESHOLD = 1.4;
const ZOOM_POLL_MS = 500;

export default function ZoomTutorialCoachmark() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage on mount. Default to dismissed so
    // SSR doesn't render the card before we know the player's
    // preference (avoids a flash on hot reload).
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== "1") setDismissed(false);
    setIsTouchDevice(
      "ontouchstart" in window || navigator.maxTouchPoints > 0
    );
  }, []);

  // Auto-dismiss once the player has actually zoomed in — the hint's
  // job is done. Polls the viewport bridge that PixiApp publishes;
  // a custom event would be cleaner but the polling cost (one ref
  // read every 500ms while the card is visible) is negligible.
  useEffect(() => {
    if (dismissed) return;
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      const viewport = window.__sparklabViewport;
      if (!viewport) return;
      const { zoom } = viewport.getTransform();
      if (zoom >= ZOOM_DISMISS_THRESHOLD) {
        setDismissed(true);
        window.localStorage.setItem(STORAGE_KEY, "1");
      }
    }, ZOOM_POLL_MS);
    return () => window.clearInterval(interval);
  }, [dismissed]);

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  };

  if (dismissed) return null;

  return (
    <div
      className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 z-30 pointer-events-auto"
      role="region"
      aria-label={t("onboarding.zoom_region_aria")}
    >
      <div className="flex items-stretch gap-2 px-2.5 py-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg ring-1 ring-slate-200 max-w-[200px] sm:max-w-[220px]">
        <ZoomDemoSvg />
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight flex items-center gap-1">
            <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-primary" />
            {t("onboarding.zoom_title")}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-600 leading-snug mt-0.5">
            {isTouchDevice
              ? t("onboarding.zoom_pinch")
              : t("onboarding.zoom_scroll")}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="self-start p-0.5 -m-0.5 rounded hover:bg-slate-100 shrink-0"
          aria-label={t("onboarding.zoom_dismiss")}
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

// Small SVG of an atom that loops the zoom-reveal:
//   * Outer body and symbol stay fully visible the whole time
//   * Nucleus dots + Bohr shell + orbiting electron fade IN at the
//     same time as a subtle scale-up, mimicking what the player sees
//     when they pinch/scroll into the canvas
//
// Pure CSS animations driven from globals.css so reduced-motion gets
// the static end frame (no looping nudge for vestibular-sensitive
// players).
function ZoomDemoSvg() {
  return (
    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-lg bg-sky-50 ring-1 ring-sky-100 flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 60 60"
        width="100%"
        height="100%"
        className="zoom-tutorial-svg"
        aria-hidden
      >
        {/* Outer atom body — always visible. */}
        <circle
          cx="30"
          cy="30"
          r="20"
          fill="url(#atomBodyGradient)"
          stroke="#0f172a"
          strokeOpacity="0.25"
          strokeWidth="0.7"
        />
        <defs>
          <radialGradient
            id="atomBodyGradient"
            cx="0.4"
            cy="0.32"
            r="0.65"
          >
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="60%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </radialGradient>
        </defs>

        {/* Element symbol — always visible. */}
        <text
          x="30"
          y="32"
          fontSize="13"
          fontWeight="700"
          fill="white"
          textAnchor="middle"
          dominantBaseline="central"
        >
          O
        </text>

        {/* Inner detail — fades in/out on a 4s loop along with a
            subtle scale, telegraphing the zoom-reveal. Group has the
            zoom-tutorial-detail animation. */}
        <g className="zoom-tutorial-detail">
          {/* Bohr shell ring */}
          <circle
            cx="30"
            cy="30"
            r="14"
            fill="none"
            stroke="#64748b"
            strokeOpacity="0.7"
            strokeWidth="0.6"
          />
          {/* Nucleus protons (red) + neutron (slate) */}
          <circle cx="28.5" cy="30" r="1.6" fill="#ef4444" />
          <circle cx="31.5" cy="30" r="1.6" fill="#ef4444" />
          <circle cx="30" cy="32" r="1.6" fill="#94a3b8" />
          {/* Orbiting electron at the top of the shell — the rotor
              spins around the atom center, carrying the electron
              with it. Same trick as AtomSpinner. */}
          <g className="zoom-tutorial-orbit">
            <circle cx="30" cy="16" r="1.6" fill="white" stroke="#334155" strokeWidth="0.4" />
          </g>
        </g>
      </svg>
    </div>
  );
}
