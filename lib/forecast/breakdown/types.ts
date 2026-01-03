export type BreakdownLine = {
  label: string;
  amount: number; // CHF/year, positiv oder negativ
};

export type YearBreakdown = {
  yearIndex: number;
  age: number;

  wealthStart: number;
  wealthEnd: number;

  income: BreakdownLine[];
  expenses: BreakdownLine[];
  debts: BreakdownLine[];

  totals: {
    income: number;
    expenses: number;
    debts: number;
    net: number;
  };
};
