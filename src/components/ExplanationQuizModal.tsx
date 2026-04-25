"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { ExplanationQuiz } from "@/types";

interface ExplanationQuizModalProps {
  quiz: ExplanationQuiz;
  explanationText: string;
  onAnswer: (correct: boolean) => void;
}

export default function ExplanationQuizModal({
  quiz,
  explanationText,
  onAnswer,
}: ExplanationQuizModalProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === quiz.correctIndex;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explanation-quiz-question"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <p className="text-sm font-semibold text-primary uppercase tracking-wide">
          One last question for the 3rd star
        </p>
        <h2
          id="explanation-quiz-question"
          className="text-xl font-bold text-foreground mt-2"
        >
          {quiz.question}
        </h2>

        <ul className="mt-4 space-y-2">
          {quiz.options.map((option, index) => {
            const isSelectedOption = selected === index;
            const isCorrectOption = index === quiz.correctIndex;
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
              <li key={index}>
                <button
                  type="button"
                  onClick={() => !answered && setSelected(index)}
                  disabled={answered}
                  className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 rounded-xl border-2 transition ${optionClass}`}
                >
                  <span className="text-base text-foreground">{option}</span>
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

        {answered && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              isCorrect
                ? "bg-green-50 text-green-900"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            <p className="font-semibold mb-1">
              {isCorrect ? "Correct!" : "Not quite — here's why:"}
            </p>
            <p>{explanationText}</p>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => answered && onAnswer(isCorrect)}
            disabled={!answered}
            className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
