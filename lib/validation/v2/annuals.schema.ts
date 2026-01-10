import { z } from "zod";
import { MoneySchema, YearSchema } from "./money.schema";

export const AnnualItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: MoneySchema,
  startYear: YearSchema.optional(),
  endYear: YearSchema.optional(),
  personId: z.string().optional(),
}).refine(
  (v) => !v.startYear || !v.endYear || v.endYear >= v.startYear,
  { message: "endYear must be >= startYear" }
);

export const AnnualsSchema = z.object({
  income: z.array(AnnualItemSchema).default([]),
  need: z.array(AnnualItemSchema).default([]),
  indexation: z.enum(["inflation", "fixed_real", "fixed_nominal"]).optional(),
});
