// lib/validation/v2/household.schema.ts
import { z } from "zod";
import { AgeSchema } from "./money.schema";

export const PersonRoleSchema = z.enum(["self", "partner", "child"]);

export const PersonSchema = z.object({
  id: z.string().min(1),
  role: PersonRoleSchema,
  firstName: z.string().optional(),

  // Contract: ISO date only (YYYY-MM-DD). No invented dates.
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  retireAtAge: AgeSchema.optional(),
});

export const HouseholdSchema = z.object({
  persons: z.array(PersonSchema).min(1),
  domicileCountry: z.string().optional(),
});
