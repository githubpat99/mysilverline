// ================================
// file: src/lib/forecast/computeForecast.ts
// ================================

import type { ForecastInput, ForecastPoint } from "../types";
import { applyExpenses } from "../expenses/applyExpenses";
import { applyIncome } from "../income/applyIncome";
import { applyDebts } from "../debts/applyDebts";

import type {
  Assumptions,
  Debt,
  IncomeLine,
  Model1DraftState,
  PensionDraft,
  SpendingAdjustmentDraft,
} from "@/lib/lotto/types";

/**
 * Convenience: build a ForecastInput from your Lotto Model1DraftState.
 * - Rechnet nur mit ganzen CHF
 * - Keine Persistenz-Annahmen
 * - Lotto-Gewinn kommt optional über `scenario`
 * - Stabil bei leeren Arrays / optionalen Feldern
 */
export function forecastInputFromLottoDraft(
  draft: Model1DraftState,
  selfAgeToday: number,
  scenario?: ForecastInput["scenario"],
): ForecastInput {
  // --- Starting wealth (CHF, whole) ---
  const wealthToday =
    (draft.wealth.liquid ?? 0) +
    (draft.wealth.invested ?? 0) +
    (draft.wealth.tiedPension ?? 0) +
    (draft.wealth.realEstate ?? 0);

  return {
    // --- identity / horizon ---
    selfAgeToday,

    // --- assets ---
    wealthToday: Math.trunc(wealthToday),

    // --- base spending ---
    annualSpendingToday: Math.trunc(draft.spending.annualSpendingToday ?? 0),
    spendingIndexation: draft.spending.indexation,
    spendingExtraGrowth: draft.spending.extraGrowth ?? 0,

    // --- spending phases / adjustments ---
    spendingAdjustments: (draft.spending.adjustments ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      startsAtAge: a.startsAtAge,
      annualDelta: Math.trunc(a.annualDelta),
    })),

    // --- one-off expenses ---
    oneOffSpendEvents: (draft.spending.oneOffEvents ?? []).map((e) => ({
      amount: Math.trunc(e.amount),
      yearOffset: e.yearOffset,
    })),

    // --- incomes ---
    otherIncomes: (draft.futureIncome.otherIncomes ?? []).map((i) => ({
      ...i,
      amountTodayOrAtStart: Math.trunc(i.amountTodayOrAtStart),
    })),

    // --- pensions ---
    pensionsSelf: (draft.futureIncome.selfPensions ?? []).map((p) => ({
      ...p,
      annuityAnnual:
        typeof p.annuityAnnual === "number" ? Math.trunc(p.annuityAnnual) : undefined,
      capitalAmount:
        typeof p.capitalAmount === "number" ? Math.trunc(p.capitalAmount) : undefined,
    })),

    pensionsPartner: (draft.futureIncome.partnerPensions ?? []).map((p) => ({
      ...p,
      annuityAnnual:
        typeof p.annuityAnnual === "number" ? Math.trunc(p.annuityAnnual) : undefined,
      capitalAmount:
        typeof p.capitalAmount === "number" ? Math.trunc(p.capitalAmount) : undefined,
    })),

    // --- debts ---
    debts: (draft.wealth.debts ?? []).map((d) => ({
      ...d,
      principalToday: Math.trunc(d.principalToday),
      annualPayment:
        typeof d.annualPayment === "number" ? Math.trunc(d.annualPayment) : undefined,
    })),

    // --- assumptions ---
    assumptions: draft.assumptions,

    // --- retirement horizon ---
    retireAtAge: draft.household.self.retireAtAge,
    planToAge: draft.household.self.planToAge,
    extraSafetyYears: draft.household.self.extraSafetyYears ?? 0,

    // --- scenario overlay (e.g. lotto) ---
    scenario,
  };
}

export function computeForecast(input: ForecastInput): ForecastPoint[] {
  const {
    selfAgeToday,
    wealthToday,
    annualSpendingToday,
    spendingIndexation,
    spendingExtraGrowth = 0,
    spendingAdjustments = [],
    oneOffSpendEvents = [],
    otherIncomes = [],
    pensionsSelf = [],
    pensionsPartner = [],
    debts = [],
    assumptions,
    retireAtAge,
    planToAge,
    extraSafetyYears = 0,
    scenario,
  } = input;

  const horizonYears = Math.max(0, planToAge + extraSafetyYears - selfAgeToday);
  const points: ForecastPoint[] = [];

  const inflation = assumptions.inflation ?? 0;

  const nominalReturn =
    assumptions.returnMode === "nominal"
      ? assumptions.nominalReturn ?? 0
      : (assumptions.realReturn ?? 0) + inflation;

  const annualFees = assumptions.annualFees ?? 0;

  // effective nominal growth applied to wealth (fees reduce return)
  const g = Math.max(-0.99, nominalReturn - annualFees);

  let wealth = Math.trunc(wealthToday);

  // scenario: one-off cash add (lotto)
  const lottoAt = scenario?.type === "lotto" ? scenario.atYearOffset ?? 0 : null;
  const lottoAmount = scenario?.type === "lotto" ? Math.trunc(scenario.lumpSumCHF) : 0;

  for (let t = 0; t <= horizonYears; t++) {
    const age = selfAgeToday + t;

    // One-off scenario add at t
    if (lottoAt !== null && t === lottoAt) {
      wealth += lottoAmount;
    }

    // ---- Expenses (annual) ----
    const expenses = applyExpenses({
      t,
      age,
      annualSpendingToday,
      spendingIndexation,
      inflation,
      spendingExtraGrowth,
      spendingAdjustments,
      oneOffSpendEvents,
    });

    // ---- Income (annual) ----
    const income = applyIncome({
      t,
      age,
      inflation,
      otherIncomes,
      pensionsSelf,
      pensionsPartner,
    });

    // ---- Debts (minimal) ----
    const debtCost = applyDebts({ debts });

    // treat debtCost as extra expenses
    const totalExpenses = expenses + debtCost;

    // Record point BEFORE applying next-year interest? Either is fine; keep consistent.
    points.push({
      yearIndex: t,
      age,
      wealth,
      income,
      expenses: totalExpenses,
    });

    // ---- Wealth evolution to next year ----
    const net = income - totalExpenses;

    // apply net cashflow, then apply return on remaining wealth (simple model)
    wealth = wealth + net;
    wealth = Math.trunc(wealth * (1 + g));
  }

  return points;
}