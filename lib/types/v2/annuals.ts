import type { Money, Year } from "./money";

export type AnnualItem = {
  id: string;
  label: string;
  amount: Money;        // CHF pro Jahr
  startYear?: Year;     // default = currentYear
  endYear?: Year;       // optional
  personId?: string;    // optional Zuordnung
};

export type Annuals = {
  income: AnnualItem[]; // wiederkehrende Einnahmen
  need: AnnualItem[];   // wiederkehrender Bedarf / Ausgaben
  indexation?: "inflation" | "fixed_real" | "fixed_nominal";
};
