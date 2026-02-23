// lib/validation/v2/events.schema.ts
import { z } from "zod";

export const EventRecurrenceSchema = z.enum(["none", "yearly", "monthly"]);
export const EventLineTypeSchema = z.enum(["income", "spending", "transfer"]);
export const EventIndexationSchema = z.enum(["inflation", "fixed_real", "fixed_nominal"]);

export const DestinationSchema = z.enum(["liquidity", "short", "long", "debt"]);
export const FundingSourceSchema = z.enum(["liquidity", "short", "long", "debt"]);
export const FundingStrategySchema = z.enum(["waterfall", "fixedSplit"]);
export const FundingBucketSchema = z.enum(["liquidity", "short", "long", "debt"]);

const FundingSourceItemSchema = z.object({
  source: FundingSourceSchema,
  share: z.number().finite().min(0).max(1).optional(),
  sourceAccountKey: z
    .string()
    .nullish()
    .transform((v) => (v === "" || v === null || v === undefined ? undefined : v)),
});

export const EventFundingSchema = z
  .object({
    fundingStrategy: FundingStrategySchema,
    fundingSources: z.array(FundingSourceItemSchema).min(1),
    minLiquidityCHF: z.number().finite().int().nonnegative().optional(),
    allowLoanAsLastResort: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fundingStrategy === "fixedSplit") {
      // shares required
      const shares = v.fundingSources.map((s) => s.share);
      if (shares.some((s) => typeof s !== "number")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fixedSplit requires share on every fundingSource",
          path: ["fundingSources"],
        });
        return;
      }
      const sum = v.fundingSources.reduce((acc, s) => acc + (s.share ?? 0), 0);
      if (Math.abs(sum - 1) > 1e-6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fixedSplit shares must sum to 1",
          path: ["fundingSources"],
        });
      }
    } else {
      // waterfall: shares must not be set (optional rule; keeps model clean)
      const anyShare = v.fundingSources.some((s) => typeof s.share === "number");
      if (anyShare) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "waterfall must not define shares",
          path: ["fundingSources"],
        });
      }
    }
  });

const AccountKeySchema = z
  .string()
  .nullish()
  .transform((v) => (v === "" || v === null || v === undefined ? undefined : v));

export const EventLineSchema = z.object({
  id: z.number().int().positive().optional(),
  line_type: EventLineTypeSchema,
  amount_chf: z.number().int().finite(),
  indexation: EventIndexationSchema.nullable(),
  category: z.string().max(80).nullable(),
  meta_json: z.any().nullable(),

  destination: DestinationSchema.nullable().optional(),
  funding: EventFundingSchema.nullable().optional(),
  destinationAccountKey: AccountKeySchema,

  transferFromKey: AccountKeySchema,
  transferToKey: AccountKeySchema,
}).superRefine((line, ctx) => {
  if (line.line_type === "income") {
    if (!line.destination) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination"], message: "income requires destination" });
    }
    if (line.funding != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["funding"], message: "income must not have funding" });
    }
  }

  if (line.line_type === "spending") {
    if (!line.funding) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["funding"], message: "spending requires funding" });
    }
    if (line.destination != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination"], message: "spending must not have destination" });
    }
  }

  if (line.line_type === "transfer") {
    if (!line.transferFromKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["transferFromKey"], message: "transfer requires transferFromKey" });
    }
    if (!line.transferToKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["transferToKey"], message: "transfer requires transferToKey" });
    }
    if (line.funding != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["funding"], message: "transfer must not have funding" });
    }
    if (line.destination != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination"], message: "transfer must not have destination" });
    }
  }
});

export const EventSchema = z.object({
  id: z.number().int().positive().optional(),
  client_id: z.string().min(1),
  title: z.string().min(1),
  start_date: z.string().min(10),
  end_date: z.string().min(10).nullable(),
  recurrence: EventRecurrenceSchema,
  active: z.union([z.literal(0), z.literal(1)]),
  meta_json: z.any().nullable(),
  line: EventLineSchema,
});

export const EventsSchema = z.array(EventSchema).default([]);
