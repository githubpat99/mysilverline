import type { Debt } from "@/lib/lotto/types";

export function applyDebts(params: { debts?: Debt[] }): number {
  const { debts = [] } = params;

  // For v1: subtract annualPayment if provided (and not payoffImmediately)
  let debtCost = 0;

  for (const d of debts) {
    if (d.payoffImmediately) continue;

    if (typeof d.annualPayment === "number") debtCost += d.annualPayment;
    else {
      // fallback: interest-only cost on principalToday (no amortization)
      debtCost += Math.trunc(d.principalToday * (d.annualInterestRate ?? 0));
    }
  }

  return Math.trunc(debtCost);
}
