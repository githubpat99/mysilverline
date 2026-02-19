// app/finance/FinanceClientPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapProfileV2 } from "@/lib/bootstrapProfileV2";

import { saveProfile, savePositions } from "@/lib/services/dataService";
import type { CompletionState, FormState, StepId } from "@/lib/types";
import { validateStep } from "@/lib/validate";
import { mapFormStateToProfileV2 } from "@/lib/mapping";

import type { ProfileV2 } from "@/lib/types/v2";

import { BarChart3, CreditCard, ArrowDownUp } from "lucide-react";
import Step1Form from "@/app/finance/components/steps/Step1Form";
import Step2Form from "@/app/finance/components/steps/Step2Form";
import Step3Form from "@/app/finance/components/steps/Step3Form";
import { mapFormStateToPositions } from "@/lib/mapping/mapFormStateToPositions";
import TemplatePicker from "@/app/finance/components/TemplatePicker";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";

type Bucket = "LIQ" | "ST" | "LT" | "REAL";

function isFormEmpty(f: FormState): boolean {
  const hasRealAssets = f.step1.positions.some(
    (p) => p.amountChf > 0 && !p.isSystem,
  );
  const hasLiqValue = f.step1.positions.some(
    (p) => p.amountChf > 0 && p.isSystem,
  );
  const hasDebts = f.step2.positions.some(
    (p) => p.balanceChf > 0 && !p.isSystem,
  );
  const hasIncome = f.step3.annualsV2.income.some((i) => i.amountCHF > 0);
  const hasExpense = f.step3.annualsV2.expense.some((e) => e.amountCHF > 0);
  return !hasRealAssets && !hasLiqValue && !hasDebts && !hasIncome && !hasExpense;
}

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
  const items: Array<{ step: StepId; label: string; shortLabel: string; icon: React.ReactNode }> = [
    { step: 1 as StepId, label: "Vermögen", shortLabel: "Vermögen", icon: <BarChart3 size={20} /> },
    { step: 2 as StepId, label: "Schulden", shortLabel: "Schulden", icon: <CreditCard size={20} /> },
    { step: 3 as StepId, label: "Einnahmen / Ausgaben", shortLabel: "Ein/Aus", icon: <ArrowDownUp size={20} /> },
  ];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {items.map((it) => {
        const active = currentStep === it.step;
        const done = !!completion[it.step];

        return (
          <button
            key={String(it.step)}
            type="button"
            onClick={() => onStepClick(it.step)}
            title={it.label}
            className={[
              "rounded-full border px-3 py-1.5 text-sm transition flex items-center gap-1.5",
              active
                ? "border-sky-500/60 bg-slate-950/40 text-sky-200"
                : "border-slate-700 bg-slate-950/20 text-slate-300 hover:border-slate-600 hover:text-slate-100",
            ].join(" ")}
            aria-current={active ? "step" : undefined}
          >
            {it.icon}
            <span className="sm:hidden text-xs">{it.shortLabel}</span>
            <span className="hidden sm:inline">{it.label}</span>
            {done ? <span className="ml-0.5 text-xs text-slate-400">✓</span> : null}
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

  const [showPicker, setShowPicker] = useState(false);
  const checkedEmpty = useRef(false);

  useEffect(() => {
    bootstrapProfileV2({
      setProfileV2,
      setForm,
      setLoading,
    });
  }, []);

  useEffect(() => {
    if (!loading && !checkedEmpty.current) {
      checkedEmpty.current = true;
      if (isFormEmpty(form)) setShowPicker(true);
    }
  }, [loading]);

  async function handleTemplateSelect(templateForm: FormState) {
    setForm(templateForm);
    const emptyProfile = makeEmptyProfileV2();
    const nextProfile = mapFormStateToProfileV2(templateForm, emptyProfile);
    const nextPositions = mapFormStateToPositions(templateForm);
    await saveProfile(nextProfile);
    await savePositions(nextPositions);
    setProfileV2(nextProfile);
    setShowPicker(false);
  }

  const isValid = useMemo(() => validateStep(currentStep, form), [currentStep, form]);

  async function buildAndSaveV2(): Promise<{ ok: boolean }> {
    if (!profileV2) {
      setSaveError("Profil noch nicht geladen.");
      return { ok: false };
    }

    const nextProfile = mapFormStateToProfileV2(form, profileV2);
    const nextPositions = mapFormStateToPositions(form);

    const r = await saveProfile(nextProfile);
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
    setProfileV2(r.profile ?? nextProfile);

    const pos = await savePositions(nextPositions);
    if (!pos.ok) {
      if (pos.status === 401 || pos.status === 403) {
        setSaveError("Nicht eingeloggt oder Nonce ungültig. Bitte neu anmelden.");
      } else if (r.status === 500) {
        setSaveError("Serverfehler beim Speichern (500).");
      } else {
        setSaveError("Speichern fehlgeschlagen.");
      }
      return { ok: false };
    }
    return { ok: true };
  }

  async function handleAutosave() {
    setSaveError("");
    if (!profileV2) return;
    await buildAndSaveV2();
  }

  const setStep1 = (next: FormState["step1"]) =>
    setForm((prev) => ({ ...prev, step1: next }));

  const setStep2 = (next: FormState["step2"]) =>
    setForm((prev) => ({ ...prev, step2: next }));

  const setStep3 = (next: FormState["step3"]) =>
    setForm((prev) => ({ ...prev, step3: next }));

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
            assets={form.step1.positions ?? []}
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
            assets={form.step1.positions ?? []}
            debts={form.step2.positions ?? []}
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
            <h1 className="text-xl font-semibold">Silverline – Finanzen</h1>
            <p className="mt-1 text-sm text-slate-300">Daten werden geladen…</p>
          </header>
        </div>
      </main>
    );
  }

  if (showPicker) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <TemplatePicker
          onSelect={handleTemplateSelect}
          onSkip={() => setShowPicker(false)}
        />
      </main>
    );
  }

  return (
    <main className=" bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-0 sm:px-4 pt-1 pb-3 sm:pt-2 sm:pb-8">

        <div className="space-y-3 sm:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <TopStepNav
              currentStep={currentStep}
              completion={completed}
              onStepClick={(step) => {
                setSaveError("");
                const ok = validateStep(currentStep, form);
                if (!ok) return;
                setCurrentStep(step);
              }}
            />
          </div>

          <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 shadow-lg">
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
