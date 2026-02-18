// lib/types/v2/events.ts

export type EventRecurrence = "none" | "yearly" | "monthly";
export type EventLineType = "income" | "spending";
export type EventIndexation = "inflation" | "fixed_real" | "fixed_nominal";

export type Destination = "liquidity" | "short" | "long" | "debt";
export type FundingSource = "liquidity" | "short" | "long" | "debt";
export type FundingStrategy = "waterfall" | "fixedSplit";

export type FundingSourceItem = {
  source: FundingSource;
  share?: number; // required if fixedSplit
  /** Echtes Konto: asset:id | debt:id – übersteuert source für Anzeige */
  sourceAccountKey?: string;
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
  destination?: Destination; // required for income (bucket für Engine)
  funding?: EventFunding;   // required for spending
  /** Echtes Konto: asset:id | debt:id – übersteuert destination für Anzeige */
  destinationAccountKey?: string;
};

export type ProfileEvent = {
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
