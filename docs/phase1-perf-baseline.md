# Phase 1 — Performance baseline

Captured 2026-04-26 against the production build (`npm run build` + `next start`) on Windows 11 / Chromium via Playwright.

This is a **baseline**, not a regression target. Phase 1 exit criteria reference the architectural targets in [ARCHITECTURE.md](../ARCHITECTURE.md): 60 FPS at 30 atoms / 20 bonds, first interactive scene < 3s on repeat visits, < 100ms action feedback. This doc records "where are we today."

## Bundle size (production build)

| Layer | Size | Notes |
|---|---|---|
| Total `.next/` | 17 MB | All routes |
| Total JS shipped | 2.2 MB across 42 chunks | Includes route-split bundles |
| Largest single chunk | 550.8 KB | Likely Pixi v8 + game scene (loaded only on `/game`) |
| 2nd largest | 222.0 KB | Likely 3dmol (loaded only on `/game` modal) |
| CSS | 39.7 KB | Single Tailwind bundle |
| Element images (`/elements/png_512`) | 5.4 MB | 118 PNGs, fetched on demand |
| Content data (`/data/*.json`) | 136 KB | Loaded once on first game route |

## Route load metrics (cold cache → warm cache)

Measured DOMContentLoaded, full Load, and resource transfer per `performance.getEntriesByType("resource")`. Times are wall-clock from `page.goto()` start.

| Route | DCL | Load | Transfer | Notes |
|---|---|---|---|---|
| `/` (home) | 26–34 ms | 99–118 ms | **282 KB** | First page; pulls shell + profile selector + i18n |
| `/periodic-table` | 16–19 ms | 36–40 ms | 0 KB* | Cached after home |
| `/settings` | 19–32 ms | 40–53 ms | 0 KB* | Cached after home |
| `/dashboard` | 10–13 ms | 21–25 ms | 0 KB* | Cached after home |
| `/worlds` | 10–12 ms | 22–24 ms | 0 KB* | Cached after home |

*Subsequent routes show 0 KB transfer because Next.js shipped the route bundles eagerly. This is good for warm-cache UX. First-visit-each-route numbers would be different and were not captured separately.

## Game scene (`/game`)

| Metric | Measured | Architectural target |
|---|---|---|
| Game boot (worlds → mission → canvas visible) | **1,009 ms** | < 3,000 ms (repeat visit) |
| FPS, idle scene (0 atoms) | **60.5** | 60 |
| FPS, 8-atom scene | **60.5** | 60 at 30 atoms / 20 bonds |

Captured via `requestAnimationFrame` tick counting in the perf probe. We are **within target on FPS** for the load tested. The 30-atom / 20-bond stress case has not been measured yet — Phase 1 should add a heavier-load sample before exit.

Targets from [ARCHITECTURE.md](../ARCHITECTURE.md):
- 60 FPS with 30 atoms + 20 bonds
- First interactive scene < 3s on repeat visits
- < 100ms action feedback

## Findings

### Strengths
1. **Production transfer on home is 282 KB** (vs. 923 KB in dev). Comfortable for low-bandwidth school networks; under a typical mobile-3G budget.
2. **Route-split is working.** Pixi (550 KB) and 3dmol (222 KB) are dynamic-imported and don't appear in the home bundle.
3. **Warm-cache navigation is essentially instant** (sub-50ms across all measured routes after home).
4. **No unexpected 100KB+ chunks** in the dependency tree — `lucide-react`, `i18next`, `dexie`, `zustand` all behave.

### Issues fixed during baseline capture

1. **`currentProfile` did not persist across hard navigation.** Bookmarks, refreshes, and deep-links bounced to `/`. Fixed by persisting the selected profile id to `localStorage` and rehydrating in a new layout-level [ProfileBootstrap](../src/components/ProfileBootstrap.tsx) component that gates child rendering until profiles are loaded. Covered by 4 new unit tests in [progressStore.test.ts](../tests/unit/progressStore.test.ts).

### Issues to address in Phase 1

1. **30-atom / 20-bond stress sample not yet captured.** The probe currently measures 0 and 8 atoms. Add a heavier sample before Phase 1 exit to confirm we hit the architectural target.
2. **5.4 MB of element PNGs** ship in `public/elements/png_512`. Most missions only reference 12 elements ([elements.json](../public/data/elements.json)). For Phase 1 the periodic-table page benefits from having the full set, but consider lazy-loading per-tile and verifying the periodic-table render budget.

### Not issues (intentionally noting)
- The 550 KB Pixi chunk is fine — it loads lazily on `/game` only.
- The 17 MB `.next/` total is build-output overhead; deployment to Vercel ships only the production assets.

## How to re-run

```bash
# Production build + manual server
npm run build
npm run start -- --port 3001

# In another terminal, run the perf probe
npx playwright test --project=chromium --grep @perf tests/e2e/perf-baseline.spec.ts
```

The spec is `describe.skip`-gated and `@perf`-tagged so it doesn't run in CI or in normal `npm run test:e2e`. Remove the skip and re-tag if it becomes a regression target.
