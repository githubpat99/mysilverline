import type { AssetDTO } from "@/lib/types/v2/positions.dto";
import type { AssetInstrument } from "@/lib/types/v2/instruments";
import { money } from "@/lib/types/v2/money";

function toMoneyCHF(n: number) {
  return money(Math.trunc(n));
}

function normStr(v: any): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export function dtoAssetToInstrument(p: AssetDTO): AssetInstrument {
  return {
    kind: "asset",
    id: p.id,
    label: p.label,

    bucket: (p.bucket ?? "instant") as any,
    assetType: p.assetType as any,

    value: toMoneyCHF(p.valueCHF),

    annualFlow: p.annualFlowCHF == null ? undefined : toMoneyCHF(p.annualFlowCHF),
    

    // NEW: routing keys (DTO snake_case -> instrument camelCase)
    sourceAccountKey: normStr((p as any).source_account_key),
    targetAccountKey: normStr((p as any).target_account_key),

    note: p.note ?? undefined,
  };
}
