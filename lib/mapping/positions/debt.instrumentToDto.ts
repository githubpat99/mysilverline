import type { DebtInstrument } from "@/lib/types/v2/instruments";
import type { DebtDTO } from "@/lib/types/v2/positions.dto";

export function instrumentDebtToDto(i: DebtInstrument): DebtDTO {
  return {
    id: i.id,
    kind: "debt",
    label: i.label,

    bucket: i.bucket,
    debtType: i.debtType as any,
    valueCHF: Math.trunc(i.value.amount),

    interestRatePct: i.interestRatePct ?? null,

    amortization: i.amortization
      ? {
          type: i.amortization.type, // direct|indirect
          amountAnnualCHF: Math.trunc(i.amortization.amountAnnual.amount),
          sourceInstrumentId: i.amortization.sourceInstrumentId,
        }
      : null,

    // NEW
    source_account_key: i.sourceAccountKey ?? undefined,
    target_account_key: i.targetAccountKey ?? undefined,

    note: i.note ?? null,
  };
}
