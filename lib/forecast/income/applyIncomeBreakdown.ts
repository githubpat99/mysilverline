import type { IncomeLine, PensionDraft } from "@/lib/lotto/types";
import { applyIndexation } from "../utils/indexation";

export function buildIncomeLines(params: {
  t: number;
  age: number;
  inflation: number;
  otherIncomes?: IncomeLine[];
  pensionsSelf?: PensionDraft[];
  pensionsPartner?: PensionDraft[];
  totalCHF: number; // authoritative total from applyIncome()
}): { lines: Array<{ label: string; amount: number }> } {
  const {
    t,
    age,
    inflation,
    otherIncomes = [],
    pensionsSelf = [],
    pensionsPartner = [],
    totalCHF,
  } = params;

  const lines: Array<{ label: string; amount: number }> = [];

  for (const line of otherIncomes) {
    const start = line.startYearOffset ?? 0;
    const end = line.endYearOffset ?? Infinity;
    if (t < start || t > end) continue;

    const dt = t - start;
    const raw = applyIndexation(
      line.amountTodayOrAtStart,
      line.indexation,
      inflation,
      dt,
      line.extraGrowth ?? 0,
    );

    lines.push({
      label: (line as any).label?.trim?.() ? (line as any).label.trim() : "Einkommen",
      amount: Math.trunc(raw),
    });
  }

  const allPensions = [...pensionsSelf, ...pensionsPartner];
  for (const p of allPensions) {
    if (age < p.startsAtAge) continue;

    const labelBase = (p as any).label?.trim?.() ? (p as any).label.trim() : "Rente";

    if (p.mode === "annuity") {
      lines.push({ label: labelBase, amount: Math.trunc(p.annuityAnnual ?? 0) });
    } else if (p.mode === "capital") {
      if (age === p.startsAtAge) {
        lines.push({ label: `${labelBase} (Kapital)`, amount: Math.trunc(p.capitalAmount ?? 0) });
      }
    }
  }

  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const remainder = totalCHF - sum;
  if (remainder !== 0) lines.push({ label: "Rundung", amount: remainder });

  const cleaned = lines.filter((l) => l.amount !== 0);
  return { lines: cleaned };
}
