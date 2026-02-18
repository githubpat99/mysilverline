import { z } from "zod";
import { HouseholdSchema } from "./household.schema";
import { InstrumentSchema } from "./instruments.schema";
import { EventSchema } from "./events.schema";
import { YearSchema } from "./money.schema";
import { AnnualsV2Schema } from "./annualsV2.schema";

export const ProfileMetaSchema = z.object({
  startYear: YearSchema,
  forecastHorizonYears: z.number().int().optional(),
  description: z.string().optional(),
});

// import { AnnualsSchema } from "./annuals.schema"; // REMOVE

export const ProfileV2Schema = z.object({
  household: HouseholdSchema,

  // instruments deprecated in profile-v2 transport (handled via /positions)
  instruments: z.any().optional().transform(() => []),

  annualsV2: AnnualsV2Schema.default({ income: [], expense: [] }),
  events: z.array(EventSchema).default([]),
  meta: ProfileMetaSchema,
});

// zentrale Parse-Funktion
export function parseProfileV2(input: unknown) {
  return ProfileV2Schema.parse(input);
}
