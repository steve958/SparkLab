# Phase 1 — Accessibility audit (discovery pass)

Captured 2026-04-26 against the production build via `axe-core` (WCAG 2.0 A + AA + WCAG 2.2 AA rule set), scanning every route in [src/app/](../src/app/).

## Headline

**Initial scan**: 14 violations across 7 routes (1 moderate × 9 occurrences + 5 serious).
**After fixes**: **0 violations across all 9 scanned routes** — clean across critical, serious, moderate, and minor.

## Resolution log

| Date | Fix | Result |
|---|---|---|
| 2026-04-26 | Removed `maximumScale: 1` from viewport ([layout.tsx](../src/app/layout.tsx)) | 9 moderate (meta-viewport) gone |
| 2026-04-26 | Bumped MVP-PIN hint slate-400 → slate-600 ([dashboard/page.tsx](../src/app/dashboard/page.tsx)) | 1 serious gone |
| 2026-04-26 | Shifted brand `--primary` token green-600 → green-700 in [globals.css](../src/app/globals.css), [manifest.json](../public/manifest.json), [layout.tsx](../src/app/layout.tsx) | 4 serious gone |
| 2026-04-26 | Bumped mission-browser meta text slate-400 → slate-600 ([MissionBrowser.tsx](../src/components/MissionBrowser.tsx)) | 2 final serious gone |

## Findings

### Moderate (1 type, 9 occurrences = 1 fix)

| Issue | Where | Root cause | Fix |
|---|---|---|---|
| `meta-viewport` — *Zooming and scaling must not be disabled* (WCAG 1.4.4) | Every route | [layout.tsx:35](../src/app/layout.tsx#L35) sets `maximumScale: 1` in the viewport metadata, which prevents pinch-zoom on iOS | Remove `maximumScale: 1` from the `viewport` export. Keep `viewportFit: "cover"` for iOS notch handling. One-line change. |

### Serious (1 type, 5 distinct cases)

All five are `color-contrast` violations. Four of them share a single root cause: the brand color `--primary: #16a34a` (Tailwind green-600) does not meet the 4.5:1 ratio for normal text — neither against white (3.93:1) nor as `text-primary` on light backgrounds (~4.05:1 on `bg-sky-50`).

| # | Route | Element | Pattern | Recommended fix |
|---|---|---|---|---|
| 1 | `/` (signed in) | `<a class="bg-primary text-white">Play</a>` ([MainMenu.tsx](../src/components/MainMenu.tsx)) | green-600 button + white text | Shift `--primary` from `#16a34a` to `#15803d` (green-700, ~5.85:1 on white) |
| 2 | `/periodic-table` | Active filter chip `border-primary bg-sky-50 text-primary` | green-600 text on sky-50 | Same fix — green-700 text passes |
| 3 | `/settings` | Active language chip `border-primary bg-sky-50 text-primary` | green-600 text on sky-50 | Same fix |
| 4 | `/dashboard` | `<p class="text-xs text-slate-400">MVP PIN: 1234</p>` | slate-400 on white | Use slate-500 or stronger; *also* this PIN hint is MVP-only per [ARCHITECTURE.md:122](../ARCHITECTURE.md#L122) — Phase 3 replaces it with a real parent gate |
| 5 | `/worlds?world=foundations` (3 nodes) | Standards-tag chip `bg-primary text-white`, mission-meta spans | Mostly the same green-600 issue + small-text on light slate | Same primary fix; verify the small-text spans clear 4.5:1 after |
| 6 | `/game` | `<span>Check</span>` inside `bg-primary text-white` button | Same as #1 | Same fix |

The proposed shift `--primary: #16a34a` → `#15803d` is a brand-color change. Previous `--primary-hover` (`#15803d`) becomes `--primary` and `--primary-hover` should darken further to `#166534` (green-800). All `bg-primary` and `text-primary` usages flip to compliant ratios in one CSS edit.

## What's NOT broken

axe-core checks but doesn't flag:

- ✅ Every interactive element has a discernible name (no missing `aria-label`).
- ✅ Heading order is correct on every route.
- ✅ Form fields have associated labels.
- ✅ Focus is not trapped.
- ✅ ARIA attributes are valid where used.
- ✅ Canvas accessibility overlay ([CanvasAccessibilityOverlay.tsx](../src/components/CanvasAccessibilityOverlay.tsx)) provides the semantic layer for the Pixi scene.
- ✅ The `aria-live` region in [game/page.tsx:400-404](../src/app/game/page.tsx#L400) announces atom/bond counts.

## What axe-core CAN'T check (manual follow-ups for Phase 1)

axe is static-analysis-ish; it can't validate runtime behaviour. These need manual verification before Phase 1 exit:

1. **Keyboard-only completion of every objective type.** [mission-keyboard.spec.ts](../tests/e2e/mission-keyboard.spec.ts) covers `build-atom`. Need analogous coverage for `build-molecule`, `count-atoms`, and `run-reaction`.
2. **Focus order.** Walk every route with Tab and confirm focus moves in document order, never jumps to the canvas, and skips correctly past the interaction-hint banner.
3. **Reduced motion.** Settings has the toggle; verify every animation (atom spawn, bond form, mission-complete star burst) respects it. Code path: [audio.ts](../src/lib/audio.ts) `setReducedMotion`, [animations.ts](../src/game/animations.ts).
4. **Screen-reader smoke.** Run NVDA on /game and confirm the ARIA-live overlay reads sensibly when atoms are added, bonded, deleted.
5. **Color blindness.** Reaction states (success / error / info feedback toasts) currently use color *and* text — verify they're also distinguishable by icon or shape per the redundancy rule in roadmap.v2.md.

## Recommended fix sequence

1. **Land the meta-viewport fix immediately** (zero risk, one line).
2. **Propose the brand-color shift** to the user; if approved, ship in one CSS edit and re-run axe to confirm zero serious violations.
3. **Cleanup of the `MVP PIN: 1234` text** — slate-500 or stronger; will be removed entirely in Phase 3.
4. **Add the keyboard-only coverage tests** for the three other objective types as a Phase 1 deliverable.
5. **Manual passes** (#2–#5 in the section above) before declaring Phase 1 a11y done.

## How to re-run

```bash
# Production server on 3001 (see phase1-perf-baseline.md)
npx playwright test --project=chromium tests/e2e/a11y-audit.spec.ts
```

The spec is `describe.skip`-gated and `@a11y`-tagged. Un-skip before Phase 1 exit re-run.
