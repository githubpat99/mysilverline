// annuals.v2.types.ts

export type MoneyCHF = number; // integer/float je nach deiner Money-Policy; Validierung unten

export type Year = number; // z.B. 2026

// Ziel-Buckets (Destination für Income / "wohin geht's?")
export type DestinationBucket = "liquidity" | "short" | "long" | "debt";

// Quellen-Buckets (Funding für Expense / "woher kommt's?")
export type FundingBucket = "liquidity" | "short" | "long" | "debt";

// Optionales Split für Destination (z.B. 60% long, 40% debt)
export type DestinationSplit = {
  destination: DestinationBucket;
  // Anteil als 0..1 (Summe = 1). Alternative wäre Prozent 0..100; wir nehmen 0..1.
  share: number;
};

export type AnnualIncomeV2 = {
  id: string;
  label: string;

  amountCHF: MoneyCHF; // pro Jahr, >= 0 (0 = inaktiv/Default)

  startYear?: Year;
  endYear?: Year;

  // Nur wenn amountCHF > 0 relevant/erforderlich (Schema enforced conditional)
  destination?: DestinationBucket;
  /** Echtes Konto: asset:id | debt:id */
  destinationAccountKey?: string;
  destinationSplit?: DestinationSplit[];
};

export type FundingStrategy = "waterfall" | "fixedSplit";

export type FundingSource = {
  source: FundingBucket; // aus welchem Bucket wird bezahlt
  // Nur relevant bei fixedSplit; bei waterfall optional/ignoriert
  share?: number; // 0..1
  /** Echtes Konto: asset:id | debt:id */
  sourceAccountKey?: string;
};

// Expense: braucht Funding zwingend
export type AnnualExpenseV2 = {
  id: string;
  label: string;

  amountCHF: MoneyCHF; // pro Jahr, >= 0 (0 = inaktiv/Default)

  startYear?: Year;
  endYear?: Year;

  // Nur wenn amountCHF > 0 relevant/erforderlich (Schema enforced conditional)
  fundingStrategy?: FundingStrategy;
  fundingSources?: FundingSource[];

  minLiquidityCHF?: MoneyCHF;
};

export type AnnualsV2 = {
  income: AnnualIncomeV2[];
  expense: AnnualExpenseV2[];
};
