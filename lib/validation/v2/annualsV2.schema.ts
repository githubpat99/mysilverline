// annualsV2.schema.ts
import { z } from "zod";
import { FundingStrategySchema } from "./events.schema";
import type { AnnualsV2 as AnnualsV2Type } from "@/lib/types/v2/annualsV2";

// ---- primitives
export const YearSchema = z
  .number()
  .int()
  .min(1900)
  .max(2200);

export const MoneyCHFSchema = z
  .number()
  .finite()
  .nonnegative(); // Betrag-Validierung erfolgt zusätzlich (Income/Expense > 0)

export const DestinationBucketSchema = z.enum(["liquidity", "short", "long", "debt"]);
export const FundingBucketSchema = z.enum(["liquidity", "short", "long", "debt"]);

export const AnnualFundingSourceItemSchema = z.object({
  source: FundingBucketSchema,
  share: z.number().finite().min(0).max(1).optional(),
  sourceAccountKey: z
    .string()
    .nullish()
    .transform((v) => (v === "" || v == null ? undefined : v)),
});

export const DestinationSplitSchema = z.object({
  destination: DestinationBucketSchema,
  share: z.number().finite().min(0).max(1),
});

export const AnnualIncomeV2Schema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),

    amountCHF: MoneyCHFSchema,

    startYear: YearSchema.optional(),
    endYear: YearSchema.optional(),

    destination: DestinationBucketSchema.optional(),
    destinationAccountKey: z
      .string()
      .nullish()
      .transform((v) => (v === "" || v == null ? undefined : v)),
    destinationSplit: z.array(DestinationSplitSchema).optional(),
  })
  .superRefine((v, ctx) => {
    // amountCHF: >= 0 (UI default 0 is allowed)
    if (!(v.amountCHF >= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountCHF"],
        message: "amountCHF must be >= 0",
      });
    }

    // start/end: end >= start
    if (v.startYear && v.endYear && v.endYear < v.startYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endYear"],
        message: "endYear must be >= startYear",
      });
    }

    const hasDest = !!v.destination;
    const split = v.destinationSplit ?? [];
    const hasSplit = split.length > 0;

    // Only enforce routing when "active" (amountCHF > 0).
    // This allows initial empty defaults (0 CHF) to pass parse/load.
    const isActive = v.amountCHF > 0;

    if (isActive) {
      // Pflicht: destination ODER destinationSplit
      if (!hasDest && !hasSplit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination"],
          message: "AnnualIncome requires destination or destinationSplit",
        });
      }

      // Nicht beides gleichzeitig
      if (hasDest && hasSplit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destinationSplit"],
          message: "Provide either destination OR destinationSplit (not both)",
        });
      }

      // Split-Summe = 1, keine doppelten Destinations
      if (hasSplit) {
        const sum = split.reduce((a, s) => a + (s.share ?? 0), 0);
        if (Math.abs(sum - 1) > 1e-6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["destinationSplit"],
            message: "destinationSplit shares must sum to 1.0",
          });
        }
        const seen = new Set<string>();
        for (const s of split) {
          if (seen.has(s.destination)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["destinationSplit"],
              message: "destinationSplit must not contain duplicate destinations",
            });
            break;
          }
          seen.add(s.destination);
        }
      }
    } else {
      // If not active (0), we keep it permissive.
      // Optional cleanup rules could go here (e.g., forbid split/dest when 0),
      // but leaving it permissive is better for UX.
    }
  });

export const AnnualExpenseV2Schema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),

    amountCHF: MoneyCHFSchema,

    startYear: YearSchema.optional(),
    endYear: YearSchema.optional(),

    // keep present but don't over-constrain when amountCHF=0
    fundingStrategy: FundingStrategySchema.optional(),
    fundingSources: z.array(AnnualFundingSourceItemSchema).optional(),

    minLiquidityCHF: MoneyCHFSchema.optional(),
  })
  .superRefine((v, ctx) => {
    // amountCHF: >= 0 (UI default 0 is allowed)
    if (!(v.amountCHF >= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountCHF"],
        message: "amountCHF must be >= 0",
      });
    }

    // start/end
    if (v.startYear && v.endYear && v.endYear < v.startYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endYear"],
        message: "endYear must be >= startYear",
      });
    }

    const isActive = v.amountCHF > 0;

    // For active expenses we enforce funding.
    if (isActive) {
      // fundingStrategy required
      if (!v.fundingStrategy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fundingStrategy"],
          message: "AnnualExpense requires fundingStrategy",
        });
      }

      const sources = v.fundingSources ?? [];

      // at least 1 source required
      if (sources.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fundingSources"],
          message: "AnnualExpense requires at least one funding source",
        });
        return;
      }

      // Keine Duplikate bei unterschiedlichen Account-Keys; bei Fallback (nur Liquidität) Duplikate tolerieren
      const withAccountKey = sources.filter((s) => (s as any).sourceAccountKey);
      if (withAccountKey.length > 1) {
        const seen = new Set<string>();
        for (const s of withAccountKey) {
          const k = (s as any).sourceAccountKey;
          if (seen.has(k)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["fundingSources"],
              message: "fundingSources must not contain duplicate account keys",
            });
            break;
          }
          seen.add(k);
        }
      }

      if (v.fundingStrategy === "fixedSplit") {
        // shares required + sum=1
        for (const s of sources) {
          if (typeof s.share !== "number") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["fundingSources"],
              message: "fixedSplit requires share on every funding source",
            });
            break;
          }
        }
        const sum = sources.reduce((a, s) => a + (s.share ?? 0), 0);
        if (Math.abs(sum - 1) > 1e-6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fundingSources"],
            message: "fixedSplit fundingSources shares must sum to 1.0",
          });
        }
      }

      if (v.fundingStrategy === "waterfall") {
        // minLiquidityCHF optional, but must be >= 0 if provided
        if (v.minLiquidityCHF !== undefined && v.minLiquidityCHF < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["minLiquidityCHF"],
            message: "minLiquidityCHF must be >= 0",
          });
        }
      }
    } else {
      // Not active (0 CHF): do not enforce funding fields.
      // Optional: you can still validate minLiquidityCHF if present
      if (v.minLiquidityCHF !== undefined && v.minLiquidityCHF < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minLiquidityCHF"],
          message: "minLiquidityCHF must be >= 0",
        });
      }
    }
  });

export const AnnualsV2Schema: z.ZodType<AnnualsV2Type> = z.object({
  income: z.array(AnnualIncomeV2Schema).default([]),
  expense: z.array(AnnualExpenseV2Schema).default([]),
});


export type AnnualIncomeV2 = z.infer<typeof AnnualIncomeV2Schema>;
export type AnnualExpenseV2 = z.infer<typeof AnnualExpenseV2Schema>;