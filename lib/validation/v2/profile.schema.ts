import { z } from "zod";
import { HouseholdSchema } from "./household.schema";
import { InstrumentSchema } from "./instruments.schema";
import { AnnualsSchema } from "./annuals.schema";
import { eventSchema } from "./events.schema";
import { YearSchema } from "./money.schema";

export const ProfileMetaSchema = z.object({
  startYear: YearSchema,
  forecastHorizonYears: z.number().int().optional(),
});

export const ProfileV2Schema = z.object({
  household: HouseholdSchema,
  instruments: z.array(InstrumentSchema).default([]),
  annuals: AnnualsSchema.default({ income: [], need: [] }),
  events: z.array(eventSchema).default([]),
  meta: ProfileMetaSchema,
});

// zentrale Parse-Funktion
export function parseProfileV2(input: unknown) {
  return ProfileV2Schema.parse(input);
}
