import type { Event } from "@/lib/types/v2/events";

export type StepId = 1 | 2 | 3;
export type InvestmentGoal = "security" | "balance" | "growth";
export type AssetType =
  | "cash"
  | "bonds"
  | "stocks"
  | "etf"
  | "funds"
  | "real_estate"
  | "gold"
  | "crypto"
  | "p2p"
  | "other";

export type Step1Data = {
  birthDate: string;            // ISO "YYYY-MM-DD"
  forecastHorizonYears?: string; // default "55"
  retireAtAge: number;          // z.B. 65
  cash: string;
  bankSavings: string;
  securities: string;
  otherInvest: string;
};

export type Step2Data = {
  creditCard: string;
  consumerLoan: string;
  otherShort: string;
  mortgage: string;
  loan: string;
  otherLong: string;
};

export type Step3Data = {
  annualIncomeToday: string;   // CHF/Jahr
  annualSpendingToday: string; // CHF/Jahr
  indexation: "inflation" | "fixed_nominal" | "fixed_real";

  // NEW: Events (v2)
  events: Event[];
};

export type FormState = {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
};

export type CompletionState = Record<StepId, boolean>;
