"use client";

import type { StepId, CompletionState } from "@/lib/types";
import { STEP_ORDER, STEP_TITLES } from "@/lib/stepConfig";

type Props = {
  currentStep: StepId;
  completion: CompletionState;
  onStepClick: (step: StepId) => void;
};

export default function StepNavigation({ currentStep, completion, onStepClick }: Props) {
  return (
    <div className="space-y-2">
      {STEP_ORDER.map((step) => {
        const active = step === currentStep;
        const done = completion?.[step];

        return (
          <button
            key={step}
            type="button"
            onClick={() => onStepClick(step)}
            className={[
              "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
              active
                ? "border-sky-500 bg-sky-500/10 text-slate-50"
                : "border-slate-800 bg-slate-950/30 text-slate-300 hover:border-slate-700",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-100">
                {step}. {STEP_TITLES[step]}
              </span>
              <span className="text-xs text-slate-400">{done ? "✓" : ""}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
