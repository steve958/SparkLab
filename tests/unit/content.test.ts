// Audits the actual JSON content shipped under public/data so that
// runtime lookups (e.g. `getString(strings, `explanation_${moleculeId}`)`)
// resolve to real text and not to the lookup key itself. getString
// silently falls back to the key when missing, which means the bug
// surfaces as `explanation_sodium_chloride` showing up in the player's
// notebook — easy to miss in code review, but caught here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface MoleculeEntry {
  moleculeId: string;
}
interface ReactionEntry {
  reactionId: string;
}
interface StringEntry {
  stringKey: string;
  locale: string;
  text: string;
}

function readJson<T>(relPath: string): T {
  const abs = resolve(__dirname, "../../public/data", relPath);
  return JSON.parse(readFileSync(abs, "utf-8")) as T;
}

const molecules = readJson<MoleculeEntry[]>("molecules.json");
const reactions = readJson<ReactionEntry[]>("reactions.json");
const strings = readJson<StringEntry[]>("strings.json");

const englishKeys = new Set(
  strings.filter((s) => s.locale === "en").map((s) => s.stringKey)
);

describe("content explanations", () => {
  // The build-molecule check in app/src/app/game/page.tsx looks up
  // `explanation_${moleculeId}`. If it's missing, getString returns
  // the literal key as fallback and the player sees the raw key in
  // the success toast and in their notebook entry.
  it("every molecule has an explanation_<moleculeId> string in en", () => {
    const missing = molecules
      .map((m) => `explanation_${m.moleculeId}`)
      .filter((k) => !englishKeys.has(k));
    expect(missing).toEqual([]);
  });

  // Same contract for run-reaction missions, which look up
  // `explanation_${reactionId}` in the validate path.
  it("every reaction has an explanation_<reactionId> string in en", () => {
    const missing = reactions
      .map((r) => `explanation_${r.reactionId}`)
      .filter((k) => !englishKeys.has(k));
    expect(missing).toEqual([]);
  });

  // No empty strings — a present-but-empty entry would render as a
  // blank notebook explanation, which is just as broken as missing.
  it("explanation strings are non-empty", () => {
    const blanks = strings
      .filter(
        (s) =>
          s.stringKey.startsWith("explanation_") &&
          s.locale === "en" &&
          s.text.trim().length === 0
      )
      .map((s) => s.stringKey);
    expect(blanks).toEqual([]);
  });
});
