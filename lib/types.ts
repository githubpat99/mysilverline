import type { AnnualsV2 } from "@/lib/types/v2/annualsV2";
import type { ProfileEvent } from "@/lib/types/v2/events";

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

export type DebtType = "mortgage" | "loan" | "consumer" | "creditcard" | "other";

export type Availability = "instant" | "3m_3y" | "gt_3y" | "locked";
export type AssetClass =
  | "cash"
  | "bank"
  | "securities"
  | "pension"
  | "real_estate"
  | "gold"
  | "crypto"
  | "p2p"
  | "other";

export type Goal = "liq" | "reinvest";

export type AssetPosition = {
  id: string;          // UI id (uuid)
  label: string;       // "Bank (Privatkonto)"
  amountChf: number;   // integer CHF (keine Strings)
  currency: "CHF";     // aktuell fix
  availability: Availability;
  assetClass: AssetClass;
  cashflowPa: number;  // CHF/Jahr
  goal: Goal;          // liq | reinvest
  notes?: string;

  // optional: DB reference (wenn du roundtrip willst)
  dbId?: number;
};

export type AmortizationType = "none" | "direct" | "indirect";

export type DebtPosition = {
  id: string;            // UI id (uuid)
  label: string;         // "Hypothek Grünaustrasse", "Visa", ...
  balanceChf: number;    // integer CHF
  currency: "CHF";       // aktuell fix
  availability: Availability;  // instant | 3m_3y | gt_3y | locked
  debtType: DebtType;

  interestRatePct?: number; // optional (z.B. 1.75)
  amortizationType?: AmortizationType;      // default: "none"
  amortizationPaChf?: number;               // CHF pro Jahr (int)
  notes?: string;
  dbId?: number;
};

export type BaseData = {
  birthDate: string;            // ISO "YYYY-MM-DD"
  forecastHorizonYears: number; // default 55
  retireAtAge?: number;          // z.B. 65
};


export type Step1Data = {
  positions: AssetPosition[];
};

export type Step2Data = {
  positions: DebtPosition[];
};

export type Step3Data = {
  annualsV2: AnnualsV2;
  events: ProfileEvent[];
};

export type FormState = {
  base: BaseData;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
};

export type CompletionState = Record<StepId, boolean>;
