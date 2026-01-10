// /lib/types/v2/events.ts

export type EventRecurrence = "none" | "yearly" | "monthly";
export type EventLineType = "income" | "spending";
export type EventIndexation = "inflation" | "fixed_real" | "fixed_nominal";

export type EventLine = {
  id?: number; // wp_..._sl_event_line.id
  line_type: EventLineType;
  amount_chf: number; // BIGINT in DB -> ganze CHF
  indexation: EventIndexation | null;
  category: string | null;
  meta_json: any | null;
};

export type Event = {
  id?: number;         // DB-ID
  client_id: string;   // stabile UI-ID (z.B. "ui:event:future_income")
  title: string;
  start_date: string;
  end_date: string | null;
  recurrence: EventRecurrence;
  active: 0 | 1;
  meta_json: any | null;
  line: EventLine;
};
