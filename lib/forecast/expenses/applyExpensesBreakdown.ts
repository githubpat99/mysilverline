import { indexationFactor, type IndexationMode } from "../utils/indexation";

type Adjustment = { label?: string; startsAtAge: number; annualDelta: number };
type OneOff = { amount: number; yearOffset: number };

export function buildExpensesLines(params: {
  t: number;
  age: number;
  annualSpendingToday: number;
  spendingIndexation: IndexationMode;
  inflation: number;
  spendingExtraGrowth?: number;
  spendingAdjustments?: Adjustment[];
  oneOffSpendEvents?: OneOff[];
  totalCHF: number; // authoritative total from applyExpenses()
}): { lines: Array<{ label: string; amount: number }> } {
  const {
    t,
    age,
    annualSpendingToday,
    spendingIndexation,
    inflation,
    spendingExtraGrowth = 0,
    spendingAdjustments = [],
    oneOffSpendEvents = [],
    totalCHF,
  } = params;

  const f = indexationFactor(spendingIndexation, inflation, t, spendingExtraGrowth);

  const activeAdjustments = spendingAdjustments.filter((a) => age >= a.startsAtAge);

  // indexed components (base + adjustments) then one-offs added after (as in v1)
  const baseRaw = annualSpendingToday * f;
  const adjRaws = activeAdjustments.map((a) => ({
    label: a.label?.trim() ? a.label.trim() : "Anpassung",
    raw: a.annualDelta * f,
  }));

  const oneOffs = oneOffSpendEvents
    .filter((e) => e.yearOffset === t)
    .map((e, i) => ({ label: `Einmalig ${i + 1}`, raw: e.amount }));

  // convert to whole CHF lines, keep totals consistent by adding remainder line
  const lines = [
    { label: "Basis", amount: Math.trunc(baseRaw) },
    ...adjRaws.map((x) => ({ label: x.label, amount: Math.trunc(x.raw) })),
    ...oneOffs.map((x) => ({ label: x.label, amount: Math.trunc(x.raw) })),
  ];

  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const remainder = totalCHF - sum;

  if (remainder !== 0) {
    lines.push({ label: "Rundung", amount: remainder });
  }

  // Optional: Remove zero-lines (except "Basis")
  const cleaned = lines.filter((l) => l.amount !== 0 || l.label === "Basis");

  return { lines: cleaned };
}
