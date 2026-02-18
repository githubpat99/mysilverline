export type IncomeFrequency = "annual";

export type IncomeLine = {
  id: string;
  label: string;
  amountTodayOrAtStart: number;

  frequency: IncomeFrequency;

  startYearOffset: number;
  endYearOffset?: number;

  indexation: "inflation" | "fixed_nominal" | "fixed_real";
  taxable: boolean;

  // optional, falls du später Personen sauber zuordnen willst
  personId?: string;

  // optional Typisierung (wenn du willst)
  incomeType?: "salary" | "ahv" | "pk" | "rent" | "other";
};
