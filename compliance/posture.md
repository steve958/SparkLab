# SparkLab privacy & safety posture

> Working document for the engineering team. Not a substitute for a real legal review. Phase 3 of the [v2 roadmap](../../roadmap.v2.md) ships the technical surfaces this document specifies; an actual privacy/legal advisor signs off before any field pilot or marketing.

## Scope of this document

- **In scope:** behavior of the SparkLab client app (PWA at `app/`).
- **In scope:** local-only persistence (IndexedDB / localStorage). Cloud sync, teacher class-code mode, ad SDKs — all deferred and out of scope here.
- **Out of scope:** marketing surfaces, store listings, parent/teacher dashboards on a future server backend.

## Frameworks we design against

1. **U.S. COPPA** — Children's Online Privacy Protection Act. Applies to operators that knowingly collect personal information (PI) from children under 13. SparkLab's audience and content make it COPPA-relevant.
2. **UK Children's Code** (ICO Age-Appropriate Design Code) — high-privacy defaults, transparency, no nudge patterns.
3. **U.S. FERPA** — relevant only if SparkLab handles school-managed student data. Out of scope until teacher mode + cloud sync ships.
4. **WCAG 2.2 AA** — accessibility (separately tracked in [phase1-a11y-audit.md](../docs/phase1-a11y-audit.md)).

## Core posture

### Principles

1. **Local-first by default.** No data leaves the device unless a parent explicitly opts in to a feature that needs it (e.g. future cloud sync).
2. **No third-party advertising or analytics SDKs.** Ever, in this product, on child-facing surfaces. This is a hard rule, not a default.
3. **Pseudonymous child accounts.** Players pick a display name (free-form, but parent-warned not to use real names). No email, phone, or birth-date collected from children.
4. **Parent gate** for any settings/data action and for any future feature that crosses the local/cloud boundary.
5. **Plain-language disclosures.** The privacy notice is age-appropriate for kids and plain-English for parents. Both versions ship in-product.
6. **Explicit, granular consent** for any new data flow added in future phases (telemetry cloud sync, leaderboards, etc.). Defaults stay off.

### What we collect

| Item | Where stored | Why |
|---|---|---|
| Child display name | IndexedDB (local) | Required to render the "Welcome back, X" UI |
| Avatar color + accessory | IndexedDB | Customization |
| Age band (8–10 / 11–14) | IndexedDB | Picks the right curriculum band |
| Mission progress (stars, attempts, completion timestamps) | IndexedDB | Resumes play, surfaces next quest |
| Discoveries (notebook entries) | IndexedDB | Powers `/notebook` |
| Badges earned | IndexedDB | Powers `/badges` |
| Mastery check answers (correct counts only) | IndexedDB | Pre/post score gap |
| Parent email + password hash *(Phase 3 in progress)* | IndexedDB | Parent gate authentication |
| Telemetry events *(Phase 3 in progress)* | IndexedDB | Powers parent-dashboard analytics |

### What we do NOT collect

- Real names, birthdates, addresses, phone numbers (children).
- Free-text notes from children (avoids accidentally storing PI).
- Any identifier from third-party trackers, ad networks, or analytics SDKs.
- Anything from a child profile that crosses the local-device boundary.
- Voice recordings, photos, video.

### Telemetry (Phase 3)

All event types are predefined; no free-text fields. Events stored locally only. Schema:

| Event | Fields | Purpose |
|---|---|---|
| `mission_start` | `missionId`, `worldId`, `ageBand`, `timestamp` | Engagement / drop-off |
| `mission_complete` | `missionId`, `worldId`, `ageBand`, `stars`, `hintsUsed`, `attempts`, `durationMs` | Mastery + difficulty |
| `mission_abandon` | `missionId`, `worldId`, `ageBand`, `attempts`, `lastError`, `durationMs` | Churn-point analysis |
| `hint_used` | `missionId`, `tier`, `outcome` | Hint effectiveness |
| `mastery_check` | `worldId`, `phase`, `correctCount`, `totalCount` | Pre/post lift |
| `sandbox_save` | `moleculeId` (or null), `atomCount` | Sandbox engagement |

Profile id is included internally to scope events; no derived identifiers outside the device.

### Retention

- **Profile data:** kept until the parent triggers Delete from the parent dashboard.
- **Telemetry events:** rolling 90-day window, oldest first. Parent can clear immediately at any time.
- **Saved scenes (autosave):** kept for the active mission only; replaced on next save.
- **Server-side:** none until cloud sync ships.

### Parent controls (Phase 3 surface)

The parent dashboard (formerly PIN-gated, now email/password-gated) exposes:

- **Profile list** — view, rename, delete each child profile.
- **Per-profile data view** — progress, discoveries, badges, mastery results.
- **Telemetry view** — summary of recent events, retention setting.
- **Export all data** — JSON download, all tables for the parent's profiles.
- **Delete all data** — wipes IndexedDB completely; confirms with the parent's password.

### Child-facing privacy notice

A short, age-appropriate page accessible from the home/lab hub. Tone: "Here's what SparkLab knows about you." Highlights:

- We remember your name, your avatar, and which missions you've finished — only on your device.
- We don't show ads, ever.
- We don't share what you do with anyone outside this device unless a grown-up turns that on.
- A grown-up can delete everything any time.

### Parent-facing privacy notice

A more detailed page at `/dashboard/privacy` (linked from settings). Covers:

- What COPPA-relevant data we do and don't collect (per the table above).
- Where it's stored and how long.
- How to export and delete.
- How to contact the operator (placeholder until distribution decisions are made).
- Effective date and version.

## Decisions still pending external review

These need real legal/privacy advisor sign-off before pilot:

1. **Operator entity** (who owns the data legally; affects which jurisdiction's law applies).
2. **Distribution surface** (web only? PWA installable from app stores? COPPA "directed-to-children" determination depends on this).
3. **School / FERPA path** when teacher mode lands (vendor or "school official" framing).
4. **Cloud sync vendor** (Supabase / Firebase / self-hosted) and its sub-processor list.
5. **Final retention windows** for telemetry — 90 days is a defensible default; some advisors prefer 30 or 14.
6. **Children's notice copy** — should be reviewed by a learning designer for age-appropriate reading level.

## Implementation status

- ✅ No third-party trackers / ad SDKs (verified by manual audit + bundle inspection)
- ✅ Pseudonymous child profiles
- ✅ Local-first IndexedDB persistence
- ✅ Export-all-data + delete-all-data flows in dashboard
- ✅ A11y posture independently verified ([phase1-a11y-audit.md](../docs/phase1-a11y-audit.md))
- 🔄 Real parent gate (Phase 3 in progress)
- 🔄 Telemetry schema + local buffer (Phase 3 in progress)
- 🔄 Plain-language notices (Phase 3 in progress)
- ⏸ Cloud sync vendor decision
- ⏸ Teacher class-code mode
- ⏸ External legal review
