// lib/types/v2/instruments.ts
import { z } from "zod";

/**
 * Money (local schema)
 * - amount can be negative (e.g., annualFlow for costs).
 * - ccy defaults to CHF.
 */
export const MoneySchema = z.object({
  amount: z.number(),
  ccy: z.string().min(1).optional().default("CHF"),
});
//export type Money = z.infer<typeof MoneySchema>;

export const AvailabilitySchema = z.enum(["instant", "3m_3y", "gt_3y", "locked"]);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const AssetTypeSchema = z.enum([
  "cash",
  "bank",
  "securities",
  "real_estate",
  "gold",
  "crypto",
  "p2p",
  "pension",
  "other",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const DebtTypeSchema = z.enum([
  "mortgage",
  "consumer",
  "creditcard",
  "loan",
  "private",
  "other_short",
  "other_long",
  "other",
]);
export type DebtType = z.infer<typeof DebtTypeSchema>;

/**
 * Account routing keys
 * - Stored/persisted as: source_account_key / target_account_key (snake_case) in DTO/DB.
 * - Used in app as camelCase: sourceAccountKey / targetAccountKey.
 *
 * Format (recommended):
 *   "asset:<instrumentId>" | "debt:<instrumentId>"
 *
 * NOTE: Zod validates shape only. Existence checks (must reference an existing account,
 * must not point to itself, LIQ constraints, etc.) should be enforced in UI/business logic.
 */
export const AccountKeySchema = z
  .string()
  .min(1)
  .refine(
    (s) => /^(asset|debt):[^:\s]+$/.test(s),
    'account key must look like "asset:<id>" or "debt:<id>"'
  );
export type AccountKey = z.infer<typeof AccountKeySchema>;

/**
 * IMPORTANT CONVENTIONS:
 * - annualFlow: exogenous annual net flow (can be + or -). NOT derived from interest/amortization.
 * - interestRatePct: percent points (1.85 means 1.85%). NEVER as factor.
 * - amortization: debt-only info for "planned paydown p.a." (kept for compatibility).
 * - targetIds: legacy relationship list (IDs only). Prefer source/targetAccountKey going forward.
 */

export const InstrumentBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),

  // Availability bucket
  bucket: AvailabilitySchema,

  // Current balance/value (asset value or debt balance)
  value: MoneySchema,

  // Optional annual net flow (e.g., rent income on an asset, yearly fee/cost)
  annualFlow: MoneySchema.optional(),

  /**
   * Legacy: Targets as IDs (instrument IDs or later "target node" IDs)
   * Keep for backward compatibility; can be deprecated once routing keys are fully used.
   */
  targetIds: z.array(z.string().min(1)).optional(),

  /**
   * NEW: explicit routing keys (preferred)
   * - sourceAccountKey: where money comes FROM
   * - targetAccountKey: where money goes TO
   *
   * These are optional at this layer (bootstrapping), but should be required by UI rules.
   */
  sourceAccountKey: AccountKeySchema.optional(),
  targetAccountKey: AccountKeySchema.optional(),

  note: z.string().optional(),
});

export type InstrumentBase = z.infer<typeof InstrumentBaseSchema>;

/**
 * Compatibility amortization shape:
 * - Your PHP currently expects amortization object { type, amountAnnualCHF, sourceInstrumentId } when present.
 * - In this file we keep a Money-based amountAnnual.
 *
 * You said you will likely move amortization to Events later; keep optional for now.
 */
export const AmortizationSchema = z.object({
  type: z.enum(["direct", "indirect"]).default("direct"),
  amountAnnual: MoneySchema.refine((m) => m.amount > 0, "amountAnnual must be > 0"),
  sourceInstrumentId: z.string().min(1), // MUST be explicit (no implicit LIQ)
});
export type Amortization = z.infer<typeof AmortizationSchema>;

export const GoalSchema = z.enum(["liq", "reinvest"]);

export const AssetInstrumentSchema = InstrumentBaseSchema.extend({
  kind: z.literal("asset"),
  assetType: AssetTypeSchema,

  // falls bei dir im Base nicht drin: value / annualFlow
  value: MoneySchema,
  annualFlow: MoneySchema.optional(),

  // NEW
  goal: GoalSchema.default("liq"),

  // routing keys
  sourceAccountKey: z.string().optional(),
  targetAccountKey: z.string().optional(),
}).superRefine((a, ctx) => {
  // sourceAccountKey: weiterhin nie self (macht fachlich keinen Sinn)
  if (a.sourceAccountKey === `asset:${a.id}`) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceAccountKey"],
      message: "sourceAccountKey must not point to itself",
    });
  }

  // targetAccountKey: self ist OK bei reinvest (thesaurierend/intern)
  if (a.goal !== "reinvest" && a.targetAccountKey === `asset:${a.id}`) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetAccountKey"],
      message: "targetAccountKey must not point to itself unless goal=reinvest",
    });
  }

  // Optional: bei goal=liq self explizit verbieten (redundant zur Regel oben)
  // Optional: bei goal=reinvest targetAccountKey erzwingen (wenn annualFlow != 0)
});


export type AssetInstrument = z.infer<typeof AssetInstrumentSchema>;

export const DebtInstrumentSchema = InstrumentBaseSchema.extend({
  kind: z.literal("debt"),
  debtType: DebtTypeSchema,

  // percent (1.85 = 1.85%). Optional, but if provided must be sane.
  interestRatePct: z.number().min(0).max(50).optional(),

  amortization: AmortizationSchema.optional(),
}).superRefine((d, ctx) => {
  // If amortization exists, the sourceInstrumentId must not point to itself.
  if (d.amortization && d.amortization.sourceInstrumentId === d.id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amortization", "sourceInstrumentId"],
      message: "amortization sourceInstrumentId must not be the same as the debt instrument id",
    });
  }

  // Optional sanity: prevent routing keys pointing to itself when using "debt:<id>".
  if (d.sourceAccountKey === `debt:${d.id}`) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceAccountKey"],
      message: "sourceAccountKey must not point to itself",
    });
  }
  if (d.targetAccountKey === `debt:${d.id}`) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetAccountKey"],
      message: "targetAccountKey must not point to itself",
    });
  }
});

export type DebtInstrument = z.infer<typeof DebtInstrumentSchema>;

export const InstrumentSchema = z.discriminatedUnion("kind", [
  AssetInstrumentSchema,
  DebtInstrumentSchema,
]);
export type Instrument = z.infer<typeof InstrumentSchema>;
