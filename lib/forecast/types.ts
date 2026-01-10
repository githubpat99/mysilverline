// src/lib/forecast/types.ts
import type {
  Assumptions,  
  IncomeLine,
  Model1DraftState,
  PensionDraft,
  SpendingAdjustmentDraft,
} from "@/lib/lotto/types";
import type { YearBreakdown } from "./breakdown/types";
import type { Event } from "../types/v2";

export type ForecastResult = {
    points: ForecastPoint[];
    breakdowns: YearBreakdown[];
};

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

  events?: Event[];

  scenario?: {
    type: "lotto";
    lumpSumCHF: number;
    atYearOffset?: number;
  };
};

export type Debt = {
  id?: string;
  label?: string;
  principalToday: number;
  annualInterestRate?: number;
  annualPayment?: number;
  payoffImmediately?: boolean;
};
