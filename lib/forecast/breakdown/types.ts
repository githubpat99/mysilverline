export type BreakdownLine = {
  label: string;
  amount: number; // CHF/year, positiv oder negativ
};

export type YearBreakdown = {
  yearIndex: number;
  age: number;
  wealthStart: number;
  wealthEnd: number;
  income: Array<{ label: string; amount: number }>;
  expenses: Array<{ label: string; amount: number }>;
  debts: Array<{ label: string; amount: number }>;
  totals: {
    income: number;
    expenses: number;
    debts: number;
    net: number;
    eventsIncome?: number;
    eventsExpense?: number;
    eventsNet?: number;
  };

    // NEW (optional, aber jetzt erlaubt)
  events?: {
    incomeLines: BreakdownLine[];
    expenseLines: BreakdownLine[];
  };
};
