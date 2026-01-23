import type { DebtDTO } from "@/lib/types/v2/positions.dto";
import type { DebtInstrument } from "@/lib/types/v2/instruments";
import { money } from "@/lib/types/v2/money";

function toMoneyCHF(n: number) {
  return money(Math.trunc(n));
}

function normStr(v: any): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export function dtoDebtToInstrument(p: DebtDTO): DebtInstrument {
  const a = (p as any).amortization ?? null;

  const amortization =
    a &&
    a.type !== "none" &&
    (a.amountAnnualCHF ?? 0) > 0 &&
    typeof a.sourceInstrumentId === "string" &&
    a.sourceInstrumentId.trim().length > 0
      ? {
          type: a.type, // "direct" | "indirect"
          amountAnnual: toMoneyCHF(a.amountAnnualCHF!), // >0 garantiert
          sourceInstrumentId: a.sourceInstrumentId.trim(),
        }
      : undefined;

  return {
    kind: "debt",
    id: p.id,
    label: p.label,

    bucket: (p.bucket ?? "3m_3y") as any,
    debtType: (p.debtType ?? "other") as any,

    value: toMoneyCHF(p.valueCHF),

    annualFlow: p.amortization == null ? undefined : toMoneyCHF(p.amortization),

    // NEW: routing keys (DTO snake_case -> instrument camelCase)
    sourceAccountKey: normStr((p as any).source_account_key),
    targetAccountKey: normStr((p as any).target_account_key),

    note: p.note ?? undefined,

    interestRatePct: p.interestRatePct ?? undefined,
    amortization,
  };
}
