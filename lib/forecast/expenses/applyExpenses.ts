import { applyIndexation, type IndexationMode } from "../utils/indexation";

export type SpendingAdjustment = { startsAtAge: number; annualDelta: number };
export type OneOffSpendEvent = { amount: number; yearOffset: number };

export function applyExpenses(params: {
  t: number;
  age: number;
  annualSpendingToday: number;
  spendingIndexation: IndexationMode;
  inflation: number;
  spendingExtraGrowth?: number;
  spendingAdjustments?: SpendingAdjustment[];
  oneOffSpendEvents?: OneOffSpendEvent[];
}): number {
  const {
    t,
    age,
    annualSpendingToday,
    spendingIndexation,
    inflation,
    spendingExtraGrowth = 0,
    spendingAdjustments = [],
    oneOffSpendEvents = [],
  } = params;

  let expenses = annualSpendingToday;

  for (const adj of spendingAdjustments) {
    if (age >= adj.startsAtAge) expenses += adj.annualDelta;
  }

  expenses = applyIndexation(expenses, spendingIndexation, inflation, t, spendingExtraGrowth);

  for (const e of oneOffSpendEvents) {
    if (e.yearOffset === t) expenses += e.amount;
  }

  return Math.trunc(expenses);
}
