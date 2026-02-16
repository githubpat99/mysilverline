import type { Household } from "./household";
import type { Instrument } from "./instruments";
import type { AnnualsV2 } from "./annualsV2";
import type { ProfileEvent } from "./events";

export type ProfileMeta = {
  startYear: number; // Default: aktuelles Kalenderjahr
  forecastHorizonYears?: number; // <-- NEW
  annualsIndexation?: "inflation" | "fixed_real" | "fixed_nominal";   // Depricated, use annuals.indexation instead
  /** Fallbeschreibung (z.B. für Musterfall) */
  description?: string;
};

export type ProfileV2 = {
  household: Household;
  instruments: Instrument[];
  annualsV2: AnnualsV2;
  events: ProfileEvent[];
  meta: ProfileMeta;
};
