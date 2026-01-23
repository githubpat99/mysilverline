import type { ProfileV2 } from "@/lib/types/v2";
import type { Instrument } from "@/lib/types/v2/instruments";

// instruments are deprecated in profile-v2 transport.
// Keep a single place that defines what FC sees for now.
export function getForecastInstruments(profile: ProfileV2): Instrument[] {
  const ins = (profile as any)?.instruments;
  return Array.isArray(ins) ? (ins as Instrument[]) : [];
}
