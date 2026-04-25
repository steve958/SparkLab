# Content Authoring Guide

SparkLab uses a JSON-based content pipeline. All chemistry data lives in `public/data/` as JSON files.

## File Overview

| File | Purpose |
|------|---------|
| `elements.json` | Periodic table data |
| `molecules.json` | Target molecular structures |
| `bond_rules.json` | Permitted bonds by age band |
| `reactions.json` | Authored reaction recipes |
| `missions.json` | Playable missions |
| `worlds.json` | World definitions |
| `strings.json` | UI text and explanations |

## Adding an Element

Add an entry to `elements.json`:

```json
{
  "atomicNumber": 6,
  "symbol": "C",
  "name": "Carbon",
  "group": 14,
  "period": 2,
  "block": "p",
  "category": "nonmetal",
  "standardAtomicWeight": 12.011,
  "stateAtStp": "solid",
  "shellOccupancy": [2, 4],
  "valenceElectronsMainGroup": 4,
  "commonOxidationStates": [-4, 2, 4],
  "electronegativityPauling": 2.55,
  "colorToken": "#1e293b",
  "iconAsset": null,
  "unlockWorld": "foundations",
  "factCardKey": "fact_carbon",
  "sourceRef": "NIST"
}
```

## Adding a Molecule

Add an entry to `molecules.json`:

```json
{
  "moleculeId": "water",
  "displayName": "Water",
  "formulaHill": "H2O",
  "ageBand": "8-10",
  "allowedBondGraph": {
    "nodes": [
      { "elementId": "O", "label": "O" },
      { "elementId": "H", "label": "H1" },
      { "elementId": "H", "label": "H2" }
    ],
    "edges": [
      { "from": 0, "to": 1, "type": "covalent-single" },
      { "from": 0, "to": 2, "type": "covalent-single" }
    ]
  },
  "synonyms": ["dihydrogen monoxide"],
  "difficulty": 1,
  "uses3dTemplate": false,
  "factKey": "fact_water"
}
```

## Adding a Mission

Add an entry to `missions.json`:

```json
{
  "missionId": "f02_make_water",
  "worldId": "foundations",
  "title": "Make Water",
  "brief": "Water is made of 2 hydrogen atoms and 1 oxygen atom.",
  "objectiveType": "build-molecule",
  "allowedElements": ["H", "O"],
  "allowedMolecules": ["water"],
  "successConditions": [
    { "type": "build-molecule", "targetMoleculeId": "water" }
  ],
  "hintSetId": "hints_water",
  "estimatedMinutes": 5,
  "standardsTags": ["NGSS-5-PS1-1"],
  "teacherNotes": "Students connect 2 H and 1 O.",
  "difficulty": 1,
  "ageBand": "8-10",
  "prerequisites": ["f01_build_h_atom"]
}
```

## Adding Strings

Add entries to `strings.json`:

```json
{
  "stringKey": "hint_water",
  "locale": "en",
  "text": "Oxygen needs 2 hydrogen atoms.",
  "voiceoverRef": null,
  "readingLevelBand": "8-10"
}
```

## Validation

The content loader validates:
- Element symbols are unique
- Molecule IDs are unique
- Bond rules reference valid elements
- Missions reference valid worlds and molecules
- Reactions reference valid molecules

Invalid content will throw an error on app load.

## Element Card Artwork

`public/elements/png_512/` ships 118 generated 512×512 element cards (one per
confirmed element), with matching SVG sources under `svg_source/`. They come
from `spark_lab_element_png_pack.zip` and are referenced via
`src/data/element-images.ts` (which reads `public/elements/manifest.json` so
spelling drift like Aluminium/Aluminum doesn't break lookups).

Used in:

- Periodic table mobile grid (`src/app/periodic-table/page.tsx`)
- Element detail modal (same file)

License: generated assets bundled with this project; see
`public/elements/README.md` for the original notice.

## CSV Migration

To migrate to CSV in the future:
1. Maintain the same column names as JSON keys
2. Convert JSON arrays to comma-separated strings
3. Convert nested objects (bond graphs) to JSON strings in cells
4. Update `src/data/loader.ts` to parse CSV instead of JSON
