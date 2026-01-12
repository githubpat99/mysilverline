"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapProfileV2 } from "@/lib/bootstrapProfileV2";

import { saveProfileV2Safe } from "@/lib/profileApiV2";
import type { CompletionState, FormState, StepId } from "@/lib/types";
import { STEP_TITLES } from "@/lib/stepConfig";
import { validateStep } from "@/lib/validate";
import { mapV2ToFormState } from "@/lib/mapping/mapV2ToForm";
import { mapFormStateToProfileV2 } from "@/lib/mapping";

import type { ProfileV2 } from "@/lib/types/v2";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";

import Step1Form from "@/app/finance/components/steps/Step1Form";
import Step2Form from "@/app/finance/components/steps/Step2Form";
import Step3Form from "@/app/finance/components/steps/Step3Form";

import StepNavigation from "./components/StepNavigation";

const INITIAL_FORM: FormState = {
  step1: {
    birthDate: "",
    retireAtAge: 65,
    forecastHorizonYears: "55",
    cash: "",
    bankSavings: "",
    securities: "",
    otherInvest: "",
  },
  step2: {
    creditCard: "",
    consumerLoan: "",
    otherShort: "",
    mortgage: "",
    loan: "",
    otherLong: "",
  },
  step3: {
    annualIncomeToday: "0",
    annualSpendingToday: "0",
    indexation: "inflation",
    events: [],
  },
};

const INITIAL_COMPLETED: CompletionState = {
  1: false,
  2: false,
  3: false,
};

export default function Page() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [completed, setCompleted] = useState<CompletionState>(INITIAL_COMPLETED);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string>("");
  const [profileV2, setProfileV2] = useState<ProfileV2 | null>(null);

  useEffect(() => {
    bootstrapProfileV2({
      setProfileV2,
      setForm,
      setLoading,
    });
  }, []);


  const isValid = useMemo(() => validateStep(currentStep, form), [currentStep, form]);

  // ---- helpers: build + save v2 (single place, so you don't duplicate logic)
  async function buildAndSaveV2(): Promise<{ ok: boolean }> {

    if (!profileV2) {
      setSaveError("Profil noch nicht geladen.");
      return { ok: false };
    }

    const next = mapFormStateToProfileV2(form, profileV2);

    console.log("Saving profileV2:", next);   // TODO PIN entfernen

    const r = await saveProfileV2Safe(next);

    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        setSaveError("Nicht eingeloggt oder Nonce ungültig. Bitte neu anmelden.");
      } else if (r.status === 500) {
        setSaveError("Serverfehler beim Speichern (500).");
      } else {
        setSaveError("Speichern fehlgeschlagen.");
      }
      return { ok: false };
    }

    setSaveError("");
    setProfileV2(r.profile ?? next); // server wins
    return { ok: true };
  }

  async function handleSave() {
    setSaveError("");

    const ok = validateStep(currentStep, form);
    if (!ok) {
      setSaveError("Bitte Schritt zuerst vollständig ausfüllen.");
      return;
    }

    const saved = await buildAndSaveV2();
    if (saved.ok) setCompleted((prev) => ({ ...prev, [currentStep]: true }));
  }

  async function handleNext() {
    setSaveError("");

    const ok = validateStep(currentStep, form);
    if (!ok) return;

    // best-effort save, aber weiter navigieren wie bei dir entschieden
    const saved = await buildAndSaveV2();
    if (saved.ok) setCompleted((prev) => ({ ...prev, [currentStep]: true }));

    setCurrentStep((s) => (s < 6 ? ((s + 1) as StepId) : s));
  }

  async function handleGoToSummary() {
    setSaveError("");

    const saved = await buildAndSaveV2();
    if (!saved.ok) return;

    router.push("/summary");
  }

  function handleBack() {
    setSaveError("");
    setCurrentStep((s) => (s > 1 ? ((s - 1) as StepId) : s));
  }

  const setStep1 = (field: keyof FormState["step1"], value: string) =>
    setForm((prev) => ({ ...prev, step1: { ...prev.step1, [field]: value } }));

  const setStep2 = (field: keyof FormState["step2"], value: string) =>
    setForm((prev) => ({ ...prev, step2: { ...prev.step2, [field]: value } }));

  const setStep3 = (next: FormState["step3"]) => setForm((prev) => ({ ...prev, step3: next }));

  const stepForm = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <Step1Form value={form.step1} onChange={setStep1} />;
      case 2:
        return <Step2Form value={form.step2} onChange={setStep2} />;
      case 3:
        return <Step3Form value={form.step3} onChange={setStep3} />;
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
              onStepClick={async (step) => {
                setSaveError("");

                const ok = validateStep(currentStep, form);
                if (!ok) return;

                // best-effort save vor Sprung
                const saved = await buildAndSaveV2();
                if (!saved.ok) return;

                setCompleted((prev) => ({ ...prev, [currentStep]: true }));
                setCurrentStep(step as StepId);
              }}
            />
          </aside>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg">
            {stepForm}

            {saveError && (
              <div className="mt-6 rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {saveError}
              </div>
            )}

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
                  <button
                    type="button"
                    onClick={handleGoToSummary}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Bil…
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
