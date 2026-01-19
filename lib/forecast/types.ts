// src/lib/forecast/types.ts
import type {
  Assumptions,  
  IncomeLine,
  Model1DraftState,
  PensionDraft,
  SpendingAdjustmentDraft,
} from "@/lib/lotto/types";
import type { YearBreakdown } from "./breakdown/types";
import type { ProfileEvent } from "@/lib/types/v2/events";

export type ForecastResult = {
  points: ForecastPoint[];
  breakdowns: YearBreakdown[];

  // optional, falls irgendwo UI es schon erwartet – aber in diesem File NICHT berechnen
  startYear?: number;
  horizonYears?: number;
  rows?: ForecastYearRow[];
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

  

  spendingExtraGrowth?: number;
  spendingAdjustments?: SpendingAdjustmentDraft[];
  oneOffSpendEvents?: Array<{ amount: number; yearOffset: number }>;


  pensionsSelf?: PensionDraft[];
  pensionsPartner?: PensionDraft[];

  debts?: Debt[];

  retireAtAge: number;
  planToAge: number;
  extraSafetyYears?: number;

  events?: ProfileEvent[];

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
export type EventRecurrence = "none" | "yearly" | "monthly";
export type EventLineType = "income" | "spending";
export type EventIndexation = "inflation" | "fixed_real" | "fixed_nominal";

export type Destination = "liquidity" | "short" | "long" | "debt";
export type FundingSource = "liquidity" | "short" | "long" | "debt";
export type FundingStrategy = "waterfall" | "fixedSplit";

export type FundingSourceItem = {
  source: FundingSource;
  share?: number; // required if fixedSplit
};

export type EventFunding = {
  fundingStrategy: FundingStrategy;
  fundingSources: FundingSourceItem[];
  minLiquidityCHF?: number;
  allowLoanAsLastResort?: boolean; // optional: wenn "debt" als letzte Quelle erlaubt sein soll
};

export type EventLine = {
  id?: number; // wp_..._sl_event_line.id
  line_type: EventLineType;
  amount_chf: number; // whole CHF
  indexation: EventIndexation | null;
  category: string | null;
  meta_json: any | null;

  // NEW (fachlich zwingend)
  destination?: Destination; // required for income
  funding?: EventFunding;    // required for spending
};

export type Event = {
  id?: number; // wp_..._sl_event.id
  client_id: string; // stable UI id, required
  title: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string | null;
  recurrence: EventRecurrence;
  active: 0 | 1;
  meta_json: any | null;
  line: EventLine;
};
// lib/forecast/types.ts

export type Bucket = "liquidity" | "short" | "long" | "real" | "debt";

export type ForecastYearRow = {
  year: number;

  // start balances
  start: Record<Bucket, number>;

  // flows within year
  incomeAnnual: number;
  expenseAnnual: number;
  eventsIncome: number;
  eventsSpending: number;
  assetCashflow: number;

  debtInterest: number;
  debtAmort: number;

  // end balances
  end: Record<Bucket, number>;

  // KPI
  netWorthEnd: number;
  notes?: string[];
};

export type RunForecastOptions = {
  startYear?: number;
  horizonYears?: number;
  interestDayCount?: 360 | 365;
};

