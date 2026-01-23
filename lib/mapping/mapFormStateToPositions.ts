// lib/mapping/mapFormStateToPositions.ts
import type { FormState } from "@/lib/types";
import type { PositionDTO, AssetDTO, DebtDTO } from "@/lib/types/v2/positions.dto";
import { formStep1ToAssetDtos, formStep2ToDebtDtos } from "@/lib/mapping/positions/formStateToDtos";

export function mapFormStateToPositions(form: FormState): PositionDTO[] {
  const assets: AssetDTO[] = Array.isArray((form.step1 as any)?.positions)
    ? (formStep1ToAssetDtos(form.step1 as any) as AssetDTO[])
    : [];

  const debts: DebtDTO[] = Array.isArray((form.step2 as any)?.positions)
    ? (formStep2ToDebtDtos(form.step2 as any) as DebtDTO[])
    : [];

    console.log("mapFormStateToPositions: assets and debts mapped", { assets, debts });

  return [...assets, ...debts];
}
