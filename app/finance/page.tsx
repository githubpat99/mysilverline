"use client";

import { useEffect, useMemo, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/profileApi";

import type { CompletionState, FormState, StepId } from "@/lib/types";
import { STEP_TITLES } from "@/lib/stepConfig";
import { validateStep } from "@/lib/validate";

import Step1Form from "@/app/finance/components/steps/Step1Form";
import Step2Form from "@/app/finance/components/steps/Step2Form";
import Step3Form from "@/app/finance/components/steps/Step3Form";
import Step4Form from "@/app/finance/components/steps/Step4Form";
import Step5Form from "@/app/finance/components/steps/Step5Form";
import Step6Form from "@/app/finance/components/steps/Step6Form";

import StepNavigation from "./components/StepNavigation";

const INITIAL_FORM: FormState = {
  step1: { cash: "", bankSavings: "", securities: "", otherInvest: "" },
  step2: {
    creditCard: "",
    consumerLoan: "",
    otherShort: "",
    mortgage: "",
    loan: "",
    otherLong: "",
  },
  step3: { futureIncome: "", futureExpense: "", notes: "" },
  step4: { goal: "", risk: null, horizonYears: null },
  step5: { preferred: [], avoided: [] },
  step6: { minLiquidity: "", monthlySaving: "" },
};

const INITIAL_COMPLETED: CompletionState = {
  1: false,
  2: false,
  3: false,
  4: false,
  5: false,
  6: false,
};

export default function Page() {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [completed, setCompleted] = useState<CompletionState>(INITIAL_COMPLETED);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const dbForm = await loadProfile();
        if (dbForm) setForm(dbForm);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isValid = useMemo(
    () => validateStep(currentStep, form),
    [currentStep, form]
  );

  async function handleSave() {
    await saveProfile(form, currentStep);
    setCompleted((prev) => ({
      ...prev,
      [currentStep]: validateStep(currentStep, form),
    }));
  }

  async function handleNext() {
    const ok = validateStep(currentStep, form);
    setCompleted((prev) => ({ ...prev, [currentStep]: ok }));
    if (!ok) return;

    await saveProfile(form, currentStep);
    setCurrentStep((s) => (s < 6 ? ((s + 1) as StepId) : s));
  }

  function handleBack() {
    setCurrentStep((s) => (s > 1 ? ((s - 1) as StepId) : s));
  }

  const setStep1 = (field: keyof FormState["step1"], value: string) =>
    setForm((prev) => ({ ...prev, step1: { ...prev.step1, [field]: value } }));

  const setStep2 = (field: keyof FormState["step2"], value: string) =>
    setForm((prev) => ({ ...prev, step2: { ...prev.step2, [field]: value } }));

  const setStep3 = (next: FormState["step3"]) =>
    setForm((prev) => ({ ...prev, step3: next }));
  const setStep4 = (next: FormState["step4"]) =>
    setForm((prev) => ({ ...prev, step4: next }));
  const setStep5 = (next: FormState["step5"]) =>
    setForm((prev) => ({ ...prev, step5: next }));
  const setStep6 = (next: FormState["step6"]) =>
    setForm((prev) => ({ ...prev, step6: next }));

  const stepForm = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <Step1Form value={form.step1} onChange={setStep1} />;
      case 2:
        return <Step2Form value={form.step2} onChange={setStep2} />;
      case 3:
        return <Step3Form value={form.step3} onChange={setStep3} />;
      case 4:
        return <Step4Form value={form.step4} onChange={setStep4} />;
      case 5:
        return <Step5Form value={form.step5} onChange={setStep5} />;
      case 6:
        return <Step6Form value={form.step6} onChange={setStep6} />;
      default:
        return null;
    }
  }, [currentStep, form]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <header className="mb-6">
            <h1 className="text-xl font-semibold">Silverline – Finanz-Workflow</h1>
            <p className="mt-1 text-sm text-slate-300">Daten werden geladen…</p>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Silverline – Finanz-Workflow</h1>
          <p className="mt-1 text-sm text-slate-300">
            Schritt {currentStep} von 6: {STEP_TITLES[currentStep]}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <StepNavigation
              currentStep={currentStep}
              completion={completed}
              onStepClick={(step) => setCurrentStep(step as StepId)}
            />
          </aside>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg">
            {stepForm}

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-40"
              >
                Zurück
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
                >
                  Speichern
                </button>

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!isValid}
                    className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
                  >
                    Weiter
                  </button>
                ) : (
                  <a
                    href="/summary"
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Zur Bilanz
                  </a>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
