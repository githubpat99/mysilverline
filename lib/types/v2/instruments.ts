import type { Money } from "./money";

export type AssetType =
  | "cash"
  | "bank"
  | "securities"
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
  id: string;
  label: string;
};

export type AssetInstrument = InstrumentBase & {
  kind: "asset";
  assetType: AssetType;
  value: Money; // aktueller Wert
};

export type DebtInstrument = InstrumentBase & {
  kind: "debt";
  debtType: DebtType;
  balance: Money; // offener Betrag
  interestRate?: number; // optional, z.B. 1.5 (= %)
};

export type Instrument = AssetInstrument | DebtInstrument;
