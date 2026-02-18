// src/lib/forecast/financeMapping.ts
//
// Result-based mapper: FinWF (FormState) -> ForecastInput
// - hard-fails if birthDate invalid/missing
// - keeps IncomeLine[] typing
// - still uses annualSpendingToday=0 (TODO) but you can optionally hard-fail on that too

import type { FormState } from "@/lib/types";
import type { ForecastInput } from "@/lib/forecast";
import type { Assumptions, IncomeLine } from "@/lib/lotto/types";
import { ageAtJan1OfYear } from "@/lib/date/age";

function parseMoneyCHF(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v !== "string") return 0;

  const s = v.trim().replace(/[\s’']/g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  const r = Math.round(x);
  if (r < lo || r > hi) return fallback;
  return r;
}

export function assumptionsFromGoal(goal: unknown): Assumptions {
  const base: Assumptions = {
    currency: "CHF",
    taxMode: "none",
    inflation: 0.015,
    returnMode: "nominal",
    nominalReturn: 0.04,
    annualFees: 0.002,
  } as Assumptions;

  if (goal === "security") return { ...base, nominalReturn: 0.03 };
  if (goal === "growth") return { ...base, nominalReturn: 0.05 };
  return base;
}

export type FinanceForecastBuild =
  | { ok: true; input: ForecastInput; derived: { baseYear: number; selfAgeToday: number } }
  | { ok: false; error: "missing_birthDate" | "invalid_birthDate"; message: string };

export function forecastInputFromFinanceProfile(
  profile: FormState,
  opts?: {
    baseYear?: number; // default current year
    planToAge?: number; // default 95
    extraSafetyYears?: number; // default 0
  }
): FinanceForecastBuild {
  const baseYear = opts?.baseYear ?? new Date().getFullYear();

  const s1: any = profile.step1 ?? {};
  const s2: any = profile.step2 ?? {};
  const s3: any = profile.step3 ?? {};
  const birthDateISO = String(s1.birthDate ?? "").trim();
  if (!birthDateISO) {
    return { ok: false, error: "missing_birthDate", message: "Geburtsdatum fehlt. Bitte in Step 1 erfassen." };
  }

  const selfAgeToday = ageAtJan1OfYear(birthDateISO, baseYear);
  if (selfAgeToday === null) {
    return { ok: false, error: "invalid_birthDate", message: "Geburtsdatum ist ungültig. Format YYYY-MM-DD." };
  }

  // Assets (Step1) — NEW (positions-based)
const assetPositions = Array.isArray(s1.positions) ? s1.positions : [];

const assets = assetPositions.reduce((sum: number, p: any) => {
  const n =
    typeof p?.amountChf === "number"
      ? p.amountChf
      : parseMoneyCHF(p?.amountChf); // fallback (shouldn't happen once types are clean)

  return sum + (Number.isFinite(n) ? Math.trunc(n) : 0);
}, 0);


  // Debts (Step2)
  const debtPositions = Array.isArray(s2.positions) ? s2.positions : [];
  const debtsTotal = debtPositions.reduce((sum: number, p: any) => {
    const n = typeof p?.balanceChf === "number" ? p.balanceChf : parseMoneyCHF(p?.balanceChf);
    return sum + (Number.isFinite(n) ? Math.trunc(n) : 0);
  }, 0);

  const wealthToday = assets - debtsTotal;

  // Retirement horizon (Step1)
  const retireAtAge = clampInt(s1.retireAtAge ?? 65, 50, 75, 65);

  // Finance plan horizon defaults
  const planToAge = clampInt(opts?.planToAge ?? 95, 70, 110, 95);
  const extraSafetyYears = clampInt(opts?.extraSafetyYears ?? 0, 0, 30, 0);

  // Step3 annualIncomeToday (not used directly, but could be in future)
  const annualIncome = parseMoneyCHF(s3.annualIncomeToday);
  const annualSpending = parseMoneyCHF(s3.annualSpendingToday);
  const idx = s3.indexation;

  // Step3 futureIncome / futureExpense (minimal v1: yearOffset 0)
  const futureIncome = parseMoneyCHF(s3.futureIncome);
  const futureExpense = parseMoneyCHF(s3.futureExpense);

  const oneOffSpendEvents =
    futureExpense > 0 ? [{ amount: futureExpense, yearOffset: 0 }] : [];

  const otherIncomes: IncomeLine[] =
    annualIncome > 0
      ? [{
        id: "finwf_annual_income_today",
        label: "Jahreseinkommen (heute)",
        amountTodayOrAtStart: annualIncome,
        frequency: "annual",
        startYearOffset: 0,
        // endYearOffset undefined => Infinity
        indexation: idx,
        taxable: true,
      }]
      : [];

  const input: ForecastInput = {
    baseYear,
    selfAgeToday,

    wealthToday: Math.trunc(wealthToday),


    spendingExtraGrowth: 0,
    spendingAdjustments: [],
    oneOffSpendEvents,


    pensionsSelf: [],
    pensionsPartner: [],

    debts: [],

    retireAtAge,
    planToAge,
    extraSafetyYears,
  };

  return { ok: true, input, derived: { baseYear, selfAgeToday } };
}
