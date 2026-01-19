export const UI_EVT = {
  futureIncome: "ui:event:future_income",
  futureExpense: "ui:event:future_expense",
} as const;

export type UiEventId = (typeof UI_EVT)[keyof typeof UI_EVT];

export const UI = {
  cash: "ui:asset:cash",
  bank: "ui:asset:bank",
  securities: "ui:asset:securities",
  otherAsset: "ui:asset:other",
  mortgage: "ui:debt:mortgage",
  consumer: "ui:debt:consumer",
  creditcard: "ui:debt:creditcard",
  otherShort: "ui:debt:otherShort",
  loan: "ui:debt:loan",
  otherLong: "ui:debt:otherLong",
  otherDebt: "ui:debt:otherDebt_sum",
} as const;
