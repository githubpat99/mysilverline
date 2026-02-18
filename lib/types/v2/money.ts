export type Currency = "CHF"; // später erweitern
export type Money = { amount: number; ccy: Currency };
export type Year = number; // z.B. 2024

export function money(amount: number, ccy: Currency = "CHF"): Money {
  const n = Number(amount);
  return { amount: Number.isFinite(n) ? Math.trunc(n) : 0, ccy };
}
