import type { AssetInstrument } from "@/lib/types/v2/instruments";
import type { AssetDTO } from "@/lib/types/v2/positions.dto";

export function instrumentAssetToDto(i: AssetInstrument): AssetDTO {
  return {
    id: i.id,
    kind: "asset",
    label: i.label,

    bucket: i.bucket,
    assetType: i.assetType,

    valueCHF: Math.trunc(i.value.amount),

    annualFlowCHF: i.annualFlow ? Math.trunc(i.annualFlow.amount) : null,
// NEW
    goal: i.goal ?? "liq",
    // NEW
    source_account_key: i.sourceAccountKey ?? undefined,
    target_account_key: i.targetAccountKey ?? undefined,

    note: i.note ?? null,
  };
}

