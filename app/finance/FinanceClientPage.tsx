// app/finance/FinanceClientPage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapProfileV2 } from "@/lib/bootstrapProfileV2";

import { saveProfileV2Safe } from "@/lib/profileApiV2";
import type { CompletionState, FormState, StepId } from "@/lib/types";
import { validateStep } from "@/lib/validate";
import { mapFormStateToProfileV2 } from "@/lib/mapping";

import type { ProfileV2 } from "@/lib/types/v2";

import Step1Form from "@/app/finance/components/steps/Step1Form";
import Step2Form from "@/app/finance/components/steps/Step2Form";
import Step3Form from "@/app/finance/components/steps/Step3Form";

type Bucket = "LIQ" | "ST" | "LT" | "REAL";

const INITIAL_FORM: FormState = {
  base: {
    birthDate: "",
    forecastHorizonYears: 55,
    retireAtAge: undefined,
  },
  step1: {
    positions: [],
  },
  step2: {
    positions: [],
  },
  step3: {
    annualsV2: { income: [], expense: [] },
    events: [],
  },
};

const INITIAL_COMPLETED: CompletionState = {
  1: false,
  2: false,
  3: false,
};

function TopStepNav({
  currentStep,
  completion,
  onStepClick,
}: {
  currentStep: StepId;
  completion: CompletionState;
  onStepClick: (s: StepId) => void;
}) {
  const items: Array<{ step: StepId; label: string }> = [
    { step: 1 as StepId, label: "Aktiven" },
    { step: 2 as StepId, label: "Passiven" },
    { step: 3 as StepId, label: "Bewegungen" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {items.map((it) => {
        const active = currentStep === it.step;
        const done = !!completion[it.step];

        return (
          <button
            key={String(it.step)}
            type="button"
            onClick={() => onStepClick(it.step)}
            className={[
              "rounded-full border px-3 py-1 text-sm transition",
              active
                ? "border-sky-500/60 bg-slate-950/40 text-sky-200"
                : "border-slate-700 bg-slate-950/20 text-slate-300 hover:border-slate-600 hover:text-slate-100",
            ].join(" ")}
            aria-current={active ? "step" : undefined}
          >
            {it.label}
            {done ? <span className="ml-2 text-xs text-slate-400">✓</span> : null}
          </button>
        );
      })}
    </div>

  );
}

export default function FinanceClientPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [completed, setCompleted] = useState<CompletionState>(INITIAL_COMPLETED);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string>("");
  const [profileV2, setProfileV2] = useState<ProfileV2 | null>(null);

  // Step-1 UI state (owned by parent)
  const [activeBucket, setActiveBucket] = useState<Bucket>("LIQ");

  // Step-3 UI state (owned by parent)
  const [annualsOpen, setAnnualsOpen] = useState<null | "income" | "expense">(null);
  const [eventOpenId, setEventOpenId] = useState<string | null>(null);

  useEffect(() => {
    bootstrapProfileV2({
      setProfileV2,
      setForm,
      setLoading,
    });
  }, []);

  const isValid = useMemo(() => validateStep(currentStep, form), [currentStep, form]);

  async function buildAndSaveV2(): Promise<{ ok: boolean }> {
    if (!profileV2) {
      setSaveError("Profil noch nicht geladen.");
      return { ok: false };
    }

    const next = mapFormStateToProfileV2(form, profileV2);
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
    setProfileV2(r.profile ?? next);
    return { ok: true };
  }

  async function handleAutosave() {
    setSaveError("");

    // Optional: wenn Profil nicht geladen ist, einfach nichts tun
    if (!profileV2) return;

    // Keine validateStep hier!
    await buildAndSaveV2();
  }

  const setStep1 = (next: FormState["step1"]) => setForm((prev) => ({ ...prev, step1: next }));

  const setStep2 = (next: FormState["step2"]) =>
    setForm((prev) => ({ ...prev, step2: next }));

  const setStep3 = (next: FormState["step3"]) => setForm((prev) => ({ ...prev, step3: next }));

  const stepForm = useMemo(() => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Form
            value={form.step1}
            onChange={setStep1}
            activeBucket={activeBucket}
            onActiveBucketChange={setActiveBucket}
            onCommit={handleAutosave}
          />
        );

      case 2:
        return (
          <Step2Form
            value={form.step2}
            onChange={setStep2}
            onCommit={handleAutosave}
          />
        );
      case 3:
        return (
          <Step3Form
            value={form.step3}
            onChange={setStep3}
            annualsOpen={annualsOpen}
            onAnnualsOpenChange={setAnnualsOpen}
            eventOpenId={eventOpenId}
            onEventOpenIdChange={setEventOpenId}
            onCommit={handleAutosave}
          />
        );
      default:
        return null;
    }
  }, [currentStep, form.step1, form.step2, form.step3, activeBucket, annualsOpen, eventOpenId]);

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
          <h1 className="text-2xl font-semibold text-slate-50">Silverline – Finanz-Workflow</h1>
        </header>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TopStepNav
              currentStep={currentStep}
              completion={completed}
              onStepClick={async (step) => {
                setSaveError("");

                const ok = validateStep(currentStep, form);
                if (!ok) return;

                const saved = await buildAndSaveV2();
                if (!saved.ok) return;

                setCompleted((prev) => ({ ...prev, [currentStep]: true }));
                setCurrentStep(step);
              }}
            />
            {/*
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Speichern
              </button>
            </div>
            */}
          </div>

          <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg">
            {stepForm}

            {saveError && (
              <div className="mt-6 rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {saveError}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
