export type StepId = 1 | 2 | 3 | 4 | 5 | 6;

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
  futureIncome: string;
  futureExpense: string;
  notes?: string;
};

export type Step4Data = {
  goal: InvestmentGoal | "";
  risk: number | null;          // 1..5
  horizonYears: number | null;  // 1..40
};

export type Step5Data = {
  preferred: AssetType[];
  avoided: AssetType[];
};

export type Step6Data = {
  minLiquidity: string;
  monthlySaving: string;
};

export type FormState = {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  step5: Step5Data;
  step6: Step6Data;
};

export type CompletionState = Record<StepId, boolean>;
