// src/lib/forecast/computeForecastFromProfileV2.ts

import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { ForecastResult } from "./types";
import { computeForecastWithBreakdown } from "@/lib/forecast/engine/computeForecast";
import { profileV2ToForecastInput } from "./profileV2ToForecastInput";

export function computeForecastFromProfileV2(profile: ProfileV2): ForecastResult {

    console.log("[FC] computeForecastFromProfileV2 called");
    
  const input = profileV2ToForecastInput(profile);

  return computeForecastWithBreakdown(input);
}
