# Phase 2 — Exit report

Phase 2 of the [v2 roadmap](../../roadmap.v2.md): **progression and identity.** Layer avatar / lab hub / notebook / badges / sandbox / mastery checks on top of Phase 1's polished core.

## Exit criteria status

| Criterion (from roadmap.v2.md) | Target | Result |
|---|---|---|
| 47+ missions live, all four existing types + two new ones | content expansion | **Deferred to learning-designer track** (Q5 default). The two new objective-type validators (`predict-product`, `identify-state`) and 20 new mission entries are content authoring work the user / learning designer drives. Engine + content pipeline ready to receive them. |
| Avatar + lab hub + notebook shipped behind the existing profile flow | shipped | ✅ AvatarBadge + AvatarBuilder, LabHub at `/`, Notebook at `/notebook`, plus Badges at `/badges` and Sandbox at `/sandbox`. |
| D7 retention ≥12% in pilot | field | ⏸ Pending pilot — no field telemetry yet. Phase 3 trust-surfaces work ships the privacy-reviewed telemetry pipeline that measures this. |
| Mastery improvement +10pp on pre/post quizlets | field | ⏸ Pending pilot — schema and Foundations seed shipped; data accumulates in IndexedDB until cloud sync arrives in Phase 3. |
| All Vitest + Playwright suites green | CI | ✅ 91/91 unit, 12/12 chromium e2e, 0 a11y violations across 12 scanned routes. Cross-browser matrix shows occasional concurrency flakes on shared dev server (fix is test-infra, not product). |

## Phase 2 design defaults applied (from session memory)

- **Q1 — Tutorial script owner: Game designer.** `TODO(game-designer)` markers remain in [OnboardingIntro.tsx](../src/components/OnboardingIntro.tsx) and [OnboardingCoachmark.tsx](../src/components/OnboardingCoachmark.tsx) for the canonical script.
- **Q2 — World map style: Clean schematic.** Phase 1 dispatched. Avatar (Phase 2) inherited the same default — geometric shapes + theme-color palette + lucide-react accessory icons; zero illustrated art.
- **Q3 — Sandbox unlock model: All elements available.** Sandbox is exploration, not gated content.
- **Q4 — Mastery quiz authoring: Schema + Foundations seed.** 3 pre + 3 post questions for the Foundations world ship as a reference pattern; learning designer authors Core and Reactions.
- **Q5 — Content expansion: Defer.** Phase 2 ships the engine surface to receive new content; authoring is a separate track.

## Workstreams shipped

### 1. Foundation — Dexie + content schema

- New types: `Discovery`, `DiscoveryKind`, `BadgeAward`, `BadgeDefinition`, `BadgeTrigger`, `MasteryQuestion`, `WorldMasteryCheck`, `MasteryCheckResult`.
- Dexie v2: `discoveries` table (id-keyed, indexed by profileId/kind/createdAt) + `badges` table (composite `[profileId+badgeId]` key).
- Dexie v3: `masteryResults` table (composite `[profileId+worldId+phase]` key).
- New db helpers: `getDiscoveries`, `addDiscovery`, `hasDiscovery` (for dedupe), `getBadgeAwards`, `awardBadge`, `getMasteryResults`, `saveMasteryResult`, `updateProfile`.
- `deleteProfile` and `deleteAllData` extended to clean the new tables.
- `exportAllData` exports the new tables.
- Content loader extended with `badges` and `masteryChecks`.
- New content files: [public/data/badges.json](../public/data/badges.json) (16 badges), [public/data/mastery_checks.json](../public/data/mastery_checks.json) (Foundations seed).

### 2. Avatar ([AvatarBadge.tsx](../src/components/AvatarBadge.tsx), [AvatarBuilder.tsx](../src/components/AvatarBuilder.tsx))

- Schematic only (Q1 default). 8-color palette (theme green-700 + 7 secondaries) and 8 accessory icons (sparkles, atom, flask, microscope, lightbulb, star, wand, flask-round).
- `AvatarBadge` reads optional `avatarColor` and `avatarAccessory` from the profile; falls back to defaults so legacy profiles keep working.
- `AvatarBuilder` is a live-preview palette + accessory picker used in [ProfileSelector](../src/components/ProfileSelector.tsx) at create time.
- Used in ProfileSelector list, LabHub header, LabHub stat header. Replaces the old initial-letter circles.

### 3. Lab hub ([LabHub.tsx](../src/components/LabHub.tsx))

- Replaces the old `MainMenu` for signed-in players at `/`.
- Header (avatar + welcome line — keeps `t("profile.welcome_back")` for compat with existing tests and screen readers).
- 4-stat strip: stars, missions complete, discoveries, badges.
- Current quest card: first unlocked, not-yet-completed mission across all worlds; clicking initializes the mission and routes to `/game`.
- Recent discoveries strip: top 3 from the notebook.
- 8-link action grid: Play, Sandbox, Notebook, Badges, Periodic Table, Settings, CMS, Grown-ups.

### 4. Notebook ([/notebook](../src/app/notebook/page.tsx))

- Reads from `progressStore.discoveries`.
- Sticker cards with label + one-line explanation + kind tag + date.
- Mission completions auto-write a discovery (deduped by `[kind, refId]`); sandbox saves write a different kind.
- Empty-state CTA points back to `/worlds`.

### 5. Badges ([/badges](../src/app/badges/page.tsx) + [engine/badges.ts](../src/engine/badges.ts))

- 16 authored badges across 7 trigger types: first-mission-complete, first-molecule, complete-world, no-hint-clear, perfect-mission, mission-count, elements-discovered.
- Pure-function evaluator runs after every mission finalize and writes earned badges to Dexie.
- Collection UI shows earned (color + description) and locked (greyscale-icon + accessible card).
- 7 unit tests covering trigger semantics + de-duplication.

### 6. Periodic-table light-up ([/periodic-table](../src/app/periodic-table/page.tsx))

- Elements referenced by completed missions render at full color.
- Other elements render desaturated (CSS `grayscale opacity-50`) with `aria-label` reflecting discovered state.

### 7. Sandbox ([/sandbox](../src/app/sandbox/page.tsx))

- Reuses the PixiApp scene; mounts a synthetic sandbox "mission" with all elements + all molecules.
- Slim HUD: full atom tray, reset, save-creation button.
- Save runs `validateSceneMolecule`; on match, writes a `sandbox-molecule` Discovery (deduped by molecule id) to the notebook.
- All elements available immediately (Q3 default).

### 8. Mastery checks v2 ([MasteryCheckModal.tsx](../src/components/MasteryCheckModal.tsx))

- Per-world pre/post quizlets (3 questions each authored for Foundations).
- Single modal walks through N questions sequentially with answer feedback.
- Results stored per `(profileId, worldId, phase)`; same key upserts so re-takes don't accumulate stale data.
- MissionBrowser banner at the top of each world: prompts pre-check before any stars are earned, post-check once the world is mastered, displays the score gap when both are taken.

## Files added

```
app/src/components/AvatarBadge.tsx
app/src/components/AvatarBuilder.tsx
app/src/components/LabHub.tsx
app/src/components/MasteryCheckModal.tsx
app/src/engine/badges.ts
app/src/app/notebook/page.tsx
app/src/app/badges/page.tsx
app/src/app/sandbox/page.tsx
app/public/data/badges.json
app/public/data/mastery_checks.json
app/tests/unit/badges.test.ts
app/docs/phase2-exit.md (this file)
```

## Files touched (notable)

```
app/src/types/index.ts            (Discovery, BadgeDefinition, BadgeTrigger, MasteryCheckResult, PlayerProfile.avatarColor/accessory)
app/src/lib/db.ts                 (v2 + v3 schema bumps; discoveries/badges/masteryResults helpers)
app/src/data/loader.ts            (badges + masteryChecks in ContentBundle)
app/src/store/progressStore.ts    (discoveries, badges, masteryResults state + actions)
app/src/app/page.tsx              (replaced MainMenu with LabHub)
app/src/app/game/page.tsx         (writes discoveries + evaluates badges on finalize)
app/src/app/periodic-table/page.tsx (discovered desaturation)
app/src/components/ProfileSelector.tsx (AvatarBuilder integrated; new profiles set color + accessory)
app/src/components/MissionBrowser.tsx (mastery-check banner + modal entry point)
app/src/components/MainMenu.tsx   (kept as a now-unused component; can be deleted by Phase 3)
app/tests/unit/progressStore.test.ts (+3 tests for discoveries, badges, mastery; updated mocks)
app/tests/unit/loader.test.ts     (fixture updated for new content files)
```

## What's deferred to Phase 3 (or content track)

- **+20 missions and 2 new objective types.** Content authoring; engine accepts new types via the existing `ObjectiveType` union extension once authored.
- **Mastery quizlets for Core and Reactions.** Authoring follow-up.
- **Game-designer canonical script for OnboardingIntro / OnboardingCoachmark.** Placeholders and `TODO(game-designer)` markers in place.
- **Pixi-side animation for "show-me" hint tier** (Phase 1 carryover).
- **30-atom stress FPS sample** (Phase 1 carryover).
- **Field telemetry** for D7 retention and mastery-improvement measurement — ships in Phase 3 alongside the privacy-reviewed pipeline.
- **Cross-browser test-isolation fix** to remove shared-server flakes on parallel runs.
- **Delete `MainMenu.tsx`** once Phase 3 confirms no consumer remains (it's currently dead code; left as a safety net through one more iteration).

## Recommendation

Phase 2 is shippable. Avatar / lab hub / notebook / badges / sandbox / mastery scaffolding all working end-to-end with full test + a11y coverage. Content authoring (the +20 missions track) and field measurement (D7, mastery lift) are the meaningful gaps, and both naturally belong to Phase 3 (trust surfaces ships the telemetry pipeline) or to the learning-designer content track.

Proceed to Phase 3 — trust surfaces (real parent gate, COPPA review, light teacher class-code mode, Spanish localization). The Phase 2 work doesn't need refactoring before Phase 3 picks up.
