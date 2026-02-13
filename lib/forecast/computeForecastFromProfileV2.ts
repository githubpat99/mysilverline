// src/lib/forecast/computeForecastFromProfileV2.ts

import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { ForecastResult } from "./types";
import { profileV2ToForecastInput } from "./profileV2ToForecastInput";
import { computeForecastWithBreakdown } from "@/lib/forecast/engine/computeForecast";

import type { AssetDTO, DebtDTO } from "@/lib/types/v2/positions.dto";

export type ForecastOut = ForecastResult & {
  liquidityToday: number;
  shortDebtToday: number;
  availabilityToday: number;
  retirementYear?: number;
};

export function computeForecastFromProfileV2(
  profile: ProfileV2,
  positions: Array<AssetDTO | DebtDTO>,
): ForecastOut {
  const input = profileV2ToForecastInput(profile, { positions });

  const out = computeForecastWithBreakdown(input);

  const baseYear = (input as any).baseYear ?? new Date().getFullYear();
  const retireAtAge = (input as any).retireAtAge ?? 65;
  const selfAgeToday = (input as any).selfAgeToday ?? 0;
  const retirementYear = baseYear + Math.max(0, retireAtAge - selfAgeToday);

  return {
    ...out,
    liquidityToday: (input as any).liquidityToday ?? 0,
    shortDebtToday: (input as any).shortDebtToday ?? 0,
    availabilityToday: (input as any).availabilityToday ?? 0,
    retirementYear,
  };
}
