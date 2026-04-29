"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import type { MasteryQuestion } from "@/types";

interface MasteryCheckModalProps {
  worldId: string;
  worldName: string;
  phase: "pre" | "post";
  questions: MasteryQuestion[];
  // Called once the player finishes all questions; total is implicit
  // from the questions array length.
  onFinish: (correctCount: number) => void;
  onCancel: () => void;
}

// Walks the player through a small ordered set of multiple-choice
// questions. Reuses the visual language of [ExplanationQuizModal] but
// strung across N questions instead of one. No timing pressure.
export default function MasteryCheckModal({
  worldId,
  worldName,
  phase,
  questions,
  onFinish,
  onCancel,
}: MasteryCheckModalProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctSoFar, setCorrectSoFar] = useState(0);

  const q = questions[index];
  const answered = selected !== null;
  const isCorrect = q ? selected === q.correctIndex : false;
  const isLast = index === questions.length - 1;

  if (!q) return null;

  const handleNext = () => {
    if (!answered) return;
    const newCorrect = correctSoFar + (isCorrect ? 1 : 0);
    if (isLast) {
      onFinish(newCorrect);
      return;
    }
    setCorrectSoFar(newCorrect);
    setIndex(index + 1);
    setSelected(null);
  };

  const phaseLabel =
    phase === "pre" ? t("mastery.phase_pre") : t("mastery.phase_post");

  const localizedQuestion = t(
    `content.mastery_checks.${worldId}.${phase}.${index}.question`,
    { defaultValue: q.question }
  );
  const localizedOption = (optionIndex: number, fallback: string) =>
    t(
      `content.mastery_checks.${worldId}.${phase}.${index}.options.${optionIndex}`,
      { defaultValue: fallback }
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mastery-question"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
            {worldName} · {phaseLabel}
          </p>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-slate-100"
            aria-label={t("mastery.close")}
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <p className="text-xs font-medium text-slate-500 mb-3">
          {t("mastery.question_progress", {
            current: index + 1,
            total: questions.length,
          })}
        </p>

        <h2
          id="mastery-question"
          className="text-lg font-bold text-foreground"
        >
          {localizedQuestion}
        </h2>

        <ul className="mt-4 space-y-2">
          {q.options.map((option, optionIndex) => {
            const isSelectedOption = selected === optionIndex;
            const isCorrectOption = optionIndex === q.correctIndex;
            let optionClass =
              "border-slate-200 hover:border-primary hover:bg-primary/5";
            if (answered) {
              if (isCorrectOption) {
                optionClass = "border-green-500 bg-green-50";
              } else if (isSelectedOption) {
                optionClass = "border-red-400 bg-red-50";
              } else {
                optionClass = "border-slate-200 opacity-60";
              }
            }
            return (
              <li key={optionIndex}>
                <button
                  type="button"
                  onClick={() => !answered && setSelected(optionIndex)}
                  disabled={answered}
                  className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 rounded-xl border-2 transition ${optionClass}`}
                >
                  <span className="text-base text-foreground">
                    {localizedOption(optionIndex, option)}
                  </span>
                  {answered && isCorrectOption && (
                    <Check className="w-5 h-5 text-green-600 shrink-0" />
                  )}
                  {answered && isSelectedOption && !isCorrectOption && (
                    <X className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleNext}
            disabled={!answered}
            className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover"
          >
            {isLast ? t("mastery.finish") : t("mastery.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
