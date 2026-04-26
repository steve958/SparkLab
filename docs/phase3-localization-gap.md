# Phase 3 — Localization gap

The i18n pipeline is fully wired: i18next provider in [I18nProvider.tsx](../src/components/I18nProvider.tsx), four locale files in [public/locales/](../public/locales/) (en/es/fr/de all real translations, not stubs), browser language detection, localStorage persistence, fallback to English, and a working language switcher in [settings/page.tsx](../src/app/settings/page.tsx).

What's **not** translated yet: strings that were hardcoded into Phase 1/2/3 components rather than routed through `t()`. These are listed below so a translator can pick them up as a single track. Until they are translated, they fall through to English on non-English locales.

## Files with hardcoded strings (translation candidates)

### Phase 1 additions

| File | Surface | Notes |
|---|---|---|
| [components/OnboardingIntro.tsx](../src/components/OnboardingIntro.tsx) | "Welcome to SparkLab", "Hi, {name}!", "Ready to build your first atom?", "Let's go", "Skip the tutorial" | Game-designer-owned per Phase 1 Q1; canonical script also pending. |
| [components/OnboardingCoachmark.tsx](../src/components/OnboardingCoachmark.tsx) | "Tap the H button up here…", "Now tap Check below…", "I got it from here" | Same as above. |
| [components/WorldMap.tsx](../src/components/WorldMap.tsx) | "Choose a World", "Pick where you want to explore", "Start here", "Continue", "Mastered" | Existing translation key `worlds.title` covers heading; the badges are new. |
| [components/GameHUD.tsx](../src/components/GameHUD.tsx) (mission-complete polish) | "First clear!", "New best", "Mastered", "{World}: X of Y missions perfect" | Achievement badges + mastery line. |

### Phase 2 additions

| File | Surface | Notes |
|---|---|---|
| [components/LabHub.tsx](../src/components/LabHub.tsx) | "Stars", "Missions", "Discoveries", "Badges", "Current quest", "Latest discoveries", "Lab tools", "Sandbox", "Notebook", "Badges", "{Name}'s Lab" | Already uses `t("profile.welcome_back")` for compat. Other labels need keys. |
| [components/AvatarBuilder.tsx](../src/components/AvatarBuilder.tsx) | "Your lab badge", "Color", "Accessory" | Three labels. |
| [components/MasteryCheckModal.tsx](../src/components/MasteryCheckModal.tsx) | "Pre-check…", "Post-check…", "Question X of Y", "Next", "Finish" | Quiz UI scaffolding. |
| [components/MissionBrowser.tsx](../src/components/MissionBrowser.tsx) (mastery banner) | "Quick check before you start", "Pre-check done · X/Y", "Post-check unlocked", "Mastery: …", "Take it" | Banner copy. |
| [app/notebook/page.tsx](../src/app/notebook/page.tsx) | "{name}'s Notebook", "Every chemistry thing you've made shows up here", "No discoveries yet", "Pick a mission" | Empty state + heading. |
| [app/badges/page.tsx](../src/app/badges/page.tsx) | "Badges", "X of Y earned. Each one celebrates…" | Heading + subhead. |
| [app/sandbox/page.tsx](../src/app/sandbox/page.tsx) | "Sandbox", "Save creation", "Saved …", "Already in your notebook…", "We don't recognize this molecule yet" | HUD copy. |
| [public/data/badges.json](../public/data/badges.json) | All 16 badge titles + descriptions | Content file; needs a `locale` extension or per-locale variant files. |
| [public/data/mastery_checks.json](../public/data/mastery_checks.json) | Foundations 3+3 questions | Same — content versioning needed. |

### Phase 3 additions

| File | Surface | Notes |
|---|---|---|
| [app/dashboard/page.tsx](../src/app/dashboard/page.tsx) | "Create a parent account…", "Sign in to manage…", "Email", "Password", "At least 8 characters", "Signed in as {email}", "Recent activity", per-profile activity stats, password-challenge dialogs | Heavy auth/data text. |
| [app/privacy/page.tsx](../src/app/privacy/page.tsx) | Both kid and parent privacy notices | These are the legally meaningful artifact and intentionally hand-written, not yet routed through i18n. Translation policy TBD with the privacy advisor — different jurisdictions may want different text, not just a translation. |
| [components/AvatarBuilder.tsx](../src/components/AvatarBuilder.tsx) | "Your lab badge", etc. | (Already listed under Phase 2.) |

## Recommended approach

1. **For UI strings** (the bulk of the gap): externalize into `public/locales/{lang}/translation.json` under a Phase-specific namespace (e.g. `lab_hub.*`, `notebook.*`, `dashboard.*`, `privacy.*`). The fallback chain already routes missing keys to English, so this can be done incrementally without breaking non-English users.
2. **For content files** (`badges.json`, `mastery_checks.json`): add a `locale` field to each entry and load the matching locale at content-load time, falling back to English. This avoids forking the JSON files.
3. **For privacy notices**: keep them under their own review. Each translation needs a privacy-advisor pass for the relevant jurisdiction; machine translation is not safe here.

## What's already in place

- Real translations of the existing English keys for es/fr/de (Phase 1 baseline).
- Locale switcher in settings; persists to localStorage and to `PlayerSettings.language` in IndexedDB.
- Browser-language detection on first run.
- `i18n.fallbackLng: "en"` so any missing key gracefully falls back.
- `getString(strings, key, locale = "en")` helper in [src/data/loader.ts](../src/data/loader.ts) for content-side strings (currently English-only, ready for locale dispatch).
