import type { Debt } from "@/lib/forecast/types";

export function buildDebtLines(params: {
  debts?: Debt[];
  totalCHF: number; // authoritative total from applyDebts()
}): { lines: Array<{ label: string; amount: number }> } {
  const { debts = [], totalCHF } = params;

  const lines: Array<{ label: string; amount: number }> = [];

  let idx = 0;
  for (const d of debts) {
    if (d.payoffImmediately) continue;
    idx++;

    const label = (d as any).label?.trim?.() ? (d as any).label.trim() : `Schuld ${idx}`;

    let cost = 0;
    if (typeof d.annualPayment === "number") cost = d.annualPayment;
    else cost = Math.trunc(d.principalToday * (d.annualInterestRate ?? 0));

    lines.push({ label, amount: Math.trunc(cost) });
  }

  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const remainder = totalCHF - sum;
  if (remainder !== 0) lines.push({ label: "Rundung", amount: remainder });

  const cleaned = lines.filter((l) => l.amount !== 0);
  return { lines: cleaned };
}
