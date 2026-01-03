// src/lib/forecast/types.ts
import type {
  Assumptions,
  Debt,
  IncomeLine,
  Model1DraftState,
  PensionDraft,
  SpendingAdjustmentDraft,
} from "@/lib/lotto/types";

export type ForecastPoint = {
  yearIndex: number;
  age: number;
  wealth: number;
  income: number;
  expenses: number;
};

export type ForecastInput = {
  baseYear?: number;
  selfAgeToday: number;

  wealthToday: number;

  annualSpendingToday: number;
  spendingIndexation: "inflation" | "fixed_nominal" | "fixed_real";
  spendingExtraGrowth?: number;
  spendingAdjustments?: SpendingAdjustmentDraft[];
  oneOffSpendEvents?: Array<{ amount: number; yearOffset: number }>;

  otherIncomes?: IncomeLine[];
  pensionsSelf?: PensionDraft[];
  pensionsPartner?: PensionDraft[];

  debts?: Debt[];

  assumptions: Assumptions;

  retireAtAge: number;
  planToAge: number;
  extraSafetyYears?: number;

  scenario?: {
    type: "lotto";
    lumpSumCHF: number;
    atYearOffset?: number;
  };
};