// instruments.ts
import type { Money } from "./money";

export type Availability = "instant" | "3m_3y" | "gt_3y" | "locked";
export type Goal = "liq" | "reinvest";

export type AssetType =
  | "cash"
  | "bank"
  | "securities"
  | "real_estate"
  | "gold"
  | "crypto"
  | "p2p"
  | "pension"
  | "other";

export type DebtType =
  | "mortgage"
  | "consumer"
  | "creditcard"
  | "other"
  | "other_short"
  | "loan"
  | "other_long";

export type InstrumentBase = {
  id: string;    // server-id OR ui-id fallback (during rollout)
  label: string;
};

// meta_json is now only notes (keep it permissive)
export type InstrumentMeta = {
  notes?: string;
  [k: string]: unknown;
};

export type AssetInstrument = InstrumentBase & {
  kind: "asset";
  assetType: AssetType;
  value: Money;

  // NEW root fields (from DB columns)
  ui_id?: string;
  availability?: Availability;
  goal?: Goal;
  cashflow_pa?: number;
  asset_class?: AssetType; // matches your backend payload
  notes?: string;
  meta_json?: InstrumentMeta;
};

export type AmortizationType = "none" | "direct" | "indirect";

export type DebtInstrument = InstrumentBase & {
  kind: "debt";
  debtType: DebtType;
  balance: Money;
  interestRate?: number;
  amortization?: {
    type: AmortizationType;
    amountAnnual?: Money;
  };

  // NEW root fields (from DB columns)
  ui_id?: string;
  availability?: Availability;
  notes?: string;
  meta_json?: InstrumentMeta;
};

export type Instrument = AssetInstrument | DebtInstrument;
