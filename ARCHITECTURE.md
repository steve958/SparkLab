# SparkLab Architecture

## Overview

SparkLab is a Next.js-based PWA with a PixiJS game scene for interactive chemistry manipulation. The architecture separates concerns into distinct layers: UI shell, game rendering, chemistry engine, content data, and persistence.

## Layer Architecture

```
┌─────────────────────────────────────────┐
│  React UI (Menus, HUD, Modals)          │
│  - Tailwind CSS                         │
│  - Zustand stores                       │
├─────────────────────────────────────────┤
│  PixiJS Game Scene (Canvas)             │
│  - Atom sprites, bond lines             │
│  - Pointer/touch interaction            │
│  - Animation system                     │
├─────────────────────────────────────────┤
│  Chemistry Rule Engine                  │
│  - Atom builder                         │
│  - Bond validation                      │
│  - Molecule graph matching              │
│  - Reaction conservation                │
├─────────────────────────────────────────┤
│  Content Data Layer                     │
│  - JSON files (elements, missions)      │
│  - Schema validation                    │
│  - Localization strings                 │
├─────────────────────────────────────────┤
│  Persistence (Dexie/IndexedDB)          │
│  - Profiles, progress, saves            │
│  - Settings                             │
└─────────────────────────────────────────┘
```

## Key Decisions

### Why PixiJS over HTML/CSS?

PixiJS provides GPU-accelerated 2D rendering needed for:
- Smooth atom dragging with 60 FPS
- Dynamic bond line rendering
- Particle effects and animations
- Touch-friendly canvas interaction

React state bridges to PixiJS display objects via refs and Zustand subscriptions.

### Why Zustand over Redux/Context?

Zustand is lightweight, has no provider boilerplate, and works outside React. This is critical because the PixiJS interaction handlers (pointer events) need to read/write game state without React re-renders.

### Why JSON over CSV for MVP?

JSON reduces tooling complexity while preserving the same schema structure. The validation logic is format-agnostic, so CSV import can be added later as a build-step transform.

### Why no physics engine?

Per the PRD, bonding is semantic (curriculum-validated) not physical. A physics engine would tempt the team into collision-based bonding, which is pedagogically incorrect. Deterministic snapping and authored animations are preferred.

## State Flow

```
User Action (drag/tap/keyboard)
  → PixiJS event handler
    → Zustand store update
      → React UI re-render (HUD)
      → PixiJS scene sync (atoms/bonds)
        → Chemistry engine validation
          → Feedback display
            → IndexedDB autosave
```

## Data Model

### Scene State (Normalized Graph)

```typescript
interface SceneState {
  atoms: SceneAtom[];   // id, elementId, x, y
  bonds: SceneBond[];   // id, atomAId, atomBId, bondType
  inventory: Record<string, number>;
}
```

This normalized structure enables:
- Easy undo/redo (command pattern)
- Deterministic save/load
- Mission validation
- Analytics replay

### Player Progress

```typescript
interface MissionProgress {
  profileId: string;
  missionId: string;
  stars: number;
  completedAt: number | null;
  attempts: number;
  bestIndependenceScore: number;
}
```

## Accessibility Pattern

Canvas is inherently inaccessible to screen readers. The solution:

1. **Visual layer**: PixiJS canvas handles rendering
2. **Semantic layer**: Invisible DOM overlay with `aria-live` regions announces game state changes
3. **Input layer**: All canvas actions have equivalent keyboard controls (Tab/Enter/Arrow keys)
4. **Focus layer**: React-managed focus indicators on all UI controls

## Performance Targets

- 60 FPS with 30 atoms + 20 bonds
- First interactive scene < 3s on repeat visits
- < 100ms action feedback

## Security & Privacy

- Static export (no server-side attack surface for child-facing content)
- Adult dashboard gated by PIN (MVP only; production needs proper auth)
- All child data stays in browser IndexedDB by default
- Content Security Policy headers in next.config.ts
