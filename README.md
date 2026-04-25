# SparkLab - Chemistry Learning Game

An interactive chemistry learning game for children ages 8–14, built as a standards-aligned, privacy-first Progressive Web App (PWA).

## Features

- **Atom Building**: Construct atoms from protons, neutrons, and electrons
- **Molecule Assembly**: Drag and bond atoms to form molecules like H₂O, CO₂, CH₄
- **Reaction Simulation**: Run authored reactions with atom conservation validation
- **Age-Banded Content**: Two worlds targeting ages 8–10 and 11–14
- **Accessibility**: Full keyboard navigation, drag alternatives, screen reader support, reduced motion
- **Privacy-First**: Anonymous local play by default; no child email collection
- **Offline Capable**: Works without internet after first load
- **Adult Dashboard**: Parent/teacher view for progress tracking and data management

## Tech Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Game Engine**: PixiJS v8 (2D canvas)
- **State Management**: Zustand
- **Local Database**: Dexie.js (IndexedDB)
- **Testing**: Vitest (unit) + Playwright (e2e)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

The static export will be generated in the `dist/` directory.

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

## Project Structure

```
src/
  app/              # Next.js app router pages
  components/       # React UI components
  game/             # PixiJS game scene
  engine/           # Chemistry rule engine
  data/             # Content loader and validation
  store/            # Zustand stores
  lib/              # Utilities and IndexedDB
  types/            # TypeScript type definitions
public/
  data/             # JSON content files (elements, missions, etc.)
tests/
  unit/             # Vitest unit tests
  e2e/              # Playwright e2e tests
```

## Content Pipeline

Chemistry content is authored as JSON files in `public/data/`:

- `elements.json` - Periodic table data for 12 starter elements
- `molecules.json` - Target molecular structures
- `bond_rules.json` - Pedagogical bond validation rules
- `reactions.json` - Authored reaction recipes
- `missions.json` - Game missions with success conditions
- `worlds.json` - World definitions
- `strings.json` - Localized UI text and explanations

The content loader validates references and caches data for offline use.

## Accessibility

- All drag actions have tap-select and keyboard alternatives
- Visible focus indicators on all interactive elements
- `aria-live` regions for game feedback
- `prefers-reduced-motion` support
- Touch targets ≥48px (56px for primary actions)
- Color never used alone to convey meaning

## Privacy & Safety

- Anonymous/local child profiles by default
- No behavioral advertising or third-party trackers
- COPPA/GDPR-aligned data minimization
- Export and delete data tools in adult dashboard
- No public chat, UGC, or social features

## License

MIT
