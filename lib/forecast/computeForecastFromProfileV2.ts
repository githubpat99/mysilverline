// src/lib/forecast/computeForecastFromProfileV2.ts

import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { ForecastResult } from "./types";
import { computeForecastWithBreakdown } from "@/lib/forecast/engine/computeForecast";
import { profileV2ToForecastInput } from "./profileV2ToForecastInput";

export type ForecastOut = ForecastResult & {
  liquidityToday: number;
  shortDebtToday: number;
  availabilityToday: number;
};

export function computeForecastFromProfileV2(profile: ProfileV2): ForecastOut {
  console.log("[FC] computeForecastFromProfileV2 called");

  const input = profileV2ToForecastInput(profile);

  const out = computeForecastWithBreakdown(input);

  return {
    ...out,
    liquidityToday: (input as any).liquidityToday ?? 0,
    shortDebtToday: (input as any).shortDebtToday ?? 0,
    availabilityToday: (input as any).availabilityToday ?? 0,
  };
}
