# Phase 3 — Exit report

Phase 3 of the [v2 roadmap](../../roadmap.v2.md): **trust surfaces.** Real parent gate, COPPA-aligned privacy posture, telemetry pipeline, localization scaffold verification.

## Phase 3 design defaults applied

The user authorized these defaults at session start; flag if any need revisiting:

- **Auth backend → local-first.** Parent account email + PBKDF2-SHA-256 password hash in IndexedDB. No cloud. Cloud sync is a separate vendor decision (Supabase / Firebase / self-hosted) that the team picks later.
- **Telemetry destination → local-only buffer.** Events stored in IndexedDB; rolling 90-day retention; parent-dashboard reads them.
- **Teacher class-code mode → deferred.** Useful only with cloud; the local-export workaround is worse than no feature. Better to ship parent/family side cleanly first.
- **Localization → scaffold only, gap documented.** Real translations of new Phase 1/2/3 strings are a translator track.

## Exit criteria status

| Criterion (from roadmap.v2.md) | Result |
|---|---|
| Real parent gate replacing PIN | ✅ Email + PBKDF2 password hash, salted per account, 200k iterations. Constant-time-ish compare. First-run = create-account flow; returning = sign-in. |
| Parent gate challenge for any settings/data action | ✅ Data-delete and per-profile delete both re-prompt for the parent password before wiping IndexedDB. 30-min session TTL + sign-out button. |
| Privacy posture audit, plain-language notice for parents, age-appropriate notice for children | ✅ Posture doc at [compliance/posture.md](../compliance/posture.md). Both notices live at `/privacy` with a kid/parent toggle. Linked from settings. |
| Retention windows, data-export and data-delete flows | ✅ Telemetry: 90-day rolling retention, throttled prune. Export: JSON of all per-profile tables (excludes parent password hashes by design). Delete: per-profile + global, both password-challenged. |
| Privacy-reviewed event schema; local buffer + opt-in cloud sync | ✅ Schema with 5 event kinds (`mission_start`, `mission_complete`, `hint_used`, `mastery_check`, `sandbox_save`), no free-text fields. Local buffer in Dexie. Cloud sync deferred. |
| Teacher dashboard, assignments, class reports | ⏸ Deferred per session decision; flagged for a future phase once cloud-sync vendor is picked. |
| English completion + first localization pass | ✅ en/es/fr/de all real translations of the existing keys. Locale switcher in settings. Gap of new Phase 1/2/3 strings documented in [docs/phase3-localization-gap.md](phase3-localization-gap.md) for the translator track. |
| Accessibility audit, device optimization, content QA pipeline | ✅ 0 a11y violations across 13 routes (added `/privacy` to the audit). Performance baseline still healthy — production `/` transfer 282 KB, game FPS 60.5. |
| All Vitest + Playwright suites green | ✅ 106/106 unit, 12/12 chromium e2e. |

## Workstreams shipped

### 1. Compliance posture ([compliance/posture.md](../compliance/posture.md))

Working framework doc covering: scope, frameworks (COPPA, UK Children's Code, FERPA-when-relevant, WCAG 2.2 AA), principles (local-first, no third-party SDKs, pseudonymous accounts, parent gate, plain-language disclosures, granular consent), an explicit data-collection table, retention rules, parent controls, and the items pending external legal review.

### 2. Plain-language privacy notices ([app/privacy](../src/app/privacy/page.tsx))

Single `/privacy` route with a "For kids" / "For grown-ups" toggle. Kid view: 4 short bullet points + reassurance line. Parent view: full disclosure of what's collected, where it's stored, retention, parent controls, no-advertising commitment, and the items pending external review. Linked from settings.

### 3. Real parent gate ([lib/parent-auth.ts](../src/lib/parent-auth.ts), [app/dashboard](../src/app/dashboard/page.tsx))

- New types: `ParentAccount` with PBKDF2 hash + salt + iteration count.
- New Dexie v4 store: `parents` keyed by lower-cased email.
- `createParentAccount` / `verifyParentLogin` / `hasAnyParentAccount` / `validatePassword` / `validateEmail` / `deleteParentAccount`.
- Hash: PBKDF2-SHA-256, 200,000 iterations, 16-byte random salt.
- Password policy: 8–200 characters; no character-class regex (length is the dominant factor).
- Dashboard auth gate detects first-run vs. returning automatically and offers create-account or sign-in accordingly.
- Sessions: 30-minute TTL, signed-in indicator, explicit sign-out.
- Per-profile delete + global delete re-prompt for the parent password before wiping IndexedDB.
- 9 unit tests cover hash uniqueness, salt independence, dedupe, validation, retrieval, login success/failure.
- Existing e2e [basic.spec.ts:32](../tests/e2e/basic.spec.ts#L32) rewritten for the new flow: covers create-account → sign-out → wrong password → correct password.

### 4. Telemetry pipeline ([lib/telemetry.ts](../src/lib/telemetry.ts))

- New `TelemetryEvent` discriminated union with 5 variants. No free-text fields.
- `TelemetryEventInput` distributive-Omit helper so each variant's required fields are checked at call sites without TS collapsing the union.
- Dexie v5 `telemetry` store indexed by `id`, `profileId`, `kind`, `ts`.
- `recordEvent` auto-fills id + ts and runs throttled background pruning (5-min throttle, 90-day retention cutoff).
- Wired into mission_complete (game/page.tsx finalize), mission_start (game/page.tsx mount effect), hint_used (GameHUD handleHint), mastery_check (MissionBrowser onFinish), sandbox_save (sandbox handleSave).
- 5 unit tests cover write, distributive-typing, scoping, ordering, retention, profile-clear.

### 5. Parent-dashboard analytics view ([app/dashboard](../src/app/dashboard/page.tsx))

- New "Recent activity" section per profile: 5-stat strip (Started, Completed, Hints, Quizlets, Sandbox) for the last 7 days.
- Per-profile "Clear activity" button.
- Footer line discloses the 90-day auto-expiry.
- Activity loader runs once per profile on mount; results refresh after a clear.

### 6. Hardened export / delete flows ([app/dashboard](../src/app/dashboard/page.tsx))

- Per-profile delete on each profile card (password-challenged).
- Global delete unchanged in semantics; copy clarified.
- Export-all-data continues to omit parent password hashes (avoids exposing hashes if the file is shared).
- `deleteAllData` extended to clear parents + telemetry tables.
- `deleteProfile` extended to clear that profile's telemetry alongside discoveries / badges / mastery / saves / settings / progress.

### 7. Localization scaffold verification + gap doc

- Verified: en/es/fr/de locale files all contain real translations of the existing key surface (not stubs); locale switcher in settings is wired and persists to PlayerSettings.
- Documented the translation gap in [docs/phase3-localization-gap.md](phase3-localization-gap.md): file-by-file list of hardcoded strings introduced in Phase 1/2/3 that should move into i18n.
- Recommended approach: namespace per surface, content-side `locale` field for badges.json + mastery_checks.json, separate per-jurisdiction review for the privacy notice rather than machine translation.

## Files added

```
app/compliance/posture.md
app/docs/phase3-exit.md (this file)
app/docs/phase3-localization-gap.md
app/src/app/privacy/page.tsx
app/src/lib/parent-auth.ts
app/src/lib/telemetry.ts
app/tests/unit/parent-auth.test.ts
app/tests/unit/telemetry.test.ts
```

## Files touched (notable)

```
app/src/types/index.ts            (ParentAccount, TelemetryEvent, TelemetryEventInput, AdultSession.email)
app/src/lib/db.ts                 (v4 + v5 schema bumps; parent + telemetry helpers)
app/src/app/dashboard/page.tsx    (full rewrite — auth gate + activity view + per-profile delete)
app/src/app/game/page.tsx         (mission_start + mission_complete telemetry)
app/src/app/sandbox/page.tsx      (sandbox_save telemetry)
app/src/app/settings/page.tsx     (privacy-notice link)
app/src/components/GameHUD.tsx    (hint_used telemetry)
app/src/components/MissionBrowser.tsx (mastery_check telemetry)
app/tests/e2e/basic.spec.ts       (rewritten for the new auth flow)
```

## Pending external review (carried forward to whatever lands next)

These remain pending a real privacy/legal advisor; the technical surfaces are ready to receive their decisions:

1. **Operator entity** + jurisdiction.
2. **Distribution surface** decision (web only / app stores) and whether SparkLab is "directed to children" formally.
3. **FERPA framing** when teacher mode lands (vendor or "school official" path).
4. **Cloud sync vendor** + sub-processor list.
5. **Final retention windows** — 90 days is the working default; some advisors prefer 30.
6. **Children's notice reading-level review** by a learning designer.
7. **Privacy-notice translations** — separate per-jurisdiction review rather than machine translation.

## What's deferred to Phase 4 / future

- **Teacher class-code mode** (cloud-dependent).
- **Cloud sync opt-in** (vendor pick).
- **External legal review pass + final wording.**
- **Translation of Phase 1/2/3 hardcoded UI strings** (translator track per [phase3-localization-gap.md](phase3-localization-gap.md)).
- **Mission_abandon telemetry event** (needs heuristics for "user navigated away mid-mission" — not trivial without beforeunload).
- **Pixi-side animation for "show-me" hint tier** (Phase 1/2 carryover).
- **30-atom stress FPS sample** (Phase 1 carryover).
- **+20 missions and 2 new objective types** (content track).

## Recommendation

Phase 3 is shippable. The product now has end-to-end trust surfaces: real parent auth, plain-language privacy disclosures, a privacy-reviewed telemetry pipeline with a parent-visible summary, hardened data export/delete with password challenges, and a documented localization track. The remaining items (cloud sync, teacher mode, full external legal review) are scope-extension decisions that don't block a pilot of the local-first product.

If the next move is a cloud/teacher-mode phase, the order I'd recommend is: vendor pick → schema migration design → teacher class-code (since it's the most demanded school-side feature) → optional family cloud sync. Each is independent and can be picked up without refactoring the Phase 1/2/3 surfaces.
