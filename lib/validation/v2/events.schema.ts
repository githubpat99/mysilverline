import { z } from "zod";

export const eventLineSchema = z.object({
  id: z.number().int().positive().optional(),
  line_type: z.enum(["income", "spending"]),
  amount_chf: z.number().finite(),
  indexation: z.enum(["inflation", "fixed_real", "fixed_nominal"]).nullable(),
  category: z.string().max(80).nullable(),
  meta_json: z.any().nullable(),
});

export const eventSchema = z.object({
  id: z.number().optional(),
  client_id: z.string().nullable().optional(), // ✅ HIER
  title: z.string(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  recurrence: z.enum(["none", "yearly", "monthly"]),
  active: z.union([z.literal(0), z.literal(1)]),
  meta_json: z.any().nullable(),
  line: eventLineSchema,
});
