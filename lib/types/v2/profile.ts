import type { Household } from "./household";
import type { Instrument } from "./instruments";
import type { Annuals } from "./annuals";
import type { Event } from "./events";

export type ProfileMeta = {
  startYear: number; // Default: aktuelles Kalenderjahr
  forecastHorizonYears?: number; // <-- NEW
  annualsIndexation?: "inflation" | "fixed_real" | "fixed_nominal";   // Depricated, use annuals.indexation instead
};

export type ProfileV2 = {
  household: Household;
  instruments: Instrument[];
  annuals: Annuals;
  events: Event[];
  meta: ProfileMeta;
};
