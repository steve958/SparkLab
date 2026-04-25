import type { ScoreState } from "@/types";

export interface ScoreCalculation {
  stars: number;
  correctness: boolean;
  independenceScore: number;
  explanationCorrect: boolean | null;
}

export function calculateScore(
  missionCorrect: boolean,
  hintsUsed: number,
  explanationCorrect: boolean | null,
  attempts: number
): ScoreCalculation {
  const correctness = missionCorrect;

  // Independence: 1.0 = no hints, 0.5 = 1 hint, 0.25 = 2 hints, 0.0 = 3+ hints
  const independenceScore =
    hintsUsed === 0 ? 1.0 : hintsUsed === 1 ? 0.5 : hintsUsed === 2 ? 0.25 : 0;

  // Star calculation:
  // 0 stars: incorrect
  // 1 star: correct but needed hints
  // 2 stars: correct with no hints or correct with explanation
  // 3 stars: correct with no hints AND explanation correct
  let stars = 0;
  if (correctness) {
    stars = 1;
    if (hintsUsed === 0 || explanationCorrect === true) {
      stars = 2;
    }
    if (hintsUsed === 0 && explanationCorrect === true) {
      stars = 3;
    }
  }

  // Penalty for many attempts (soft cap at 3+)
  if (attempts > 3 && stars > 1) {
    stars = Math.max(1, stars - 1);
  }

  return {
    stars,
    correctness,
    independenceScore,
    explanationCorrect,
  };
}

export function createInitialScoreState(): ScoreState {
  return {
    stars: 0,
    correctness: false,
    independenceScore: 0,
    explanationCorrect: null,
    attempts: 0,
    startTime: Date.now(),
    endTime: null,
  };
}
