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

// Canonical account key used across UI + API (matches backend snake_case fields)
export type AccountKey = string; // e.g. "asset:pos_1ntjij7l" | "debt:d_...."

export type AssetPosition = {
  id: string; // UI id
  label: string;
  amountChf: number; // integer CHF
  currency: "CHF";

  availability: Availability;
  assetClass: AssetClass;

  cashflowPa: number; // CHF per year (int)
  goal: Goal; // liq | reinvest
  notes?: string;

  // Gegenkonto (Quelle/Ziel je nach Logik)
  sourceAccountKey?: AccountKey;
  targetAccountKey?: AccountKey;

  dbId?: number;
};

export type AmortizationType = "none" | "direct" | "indirect";

export type DebtPosition = {
  id: string; // UI id
  label: string;
  balanceChf: number; // integer CHF
  currency: "CHF";

  availability: Availability;
  debtType: DebtType;

  interestRatePct?: number; // optional (z.B. 1.75)

  sourceAccountKey?: AccountKey;
  targetAccountKey?: AccountKey;

  amortizationPaChf?: number; // CHF pro Jahr (int)
  notes?: string;

  dbId?: number;
};

export type BaseData = {
  birthDate: string; // ISO "YYYY-MM-DD"
  forecastHorizonYears: number; // default 55
  retireAtAge?: number; // z.B. 65
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
export type Bucket = Availability;