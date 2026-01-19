// instruments.schema.ts
import { z } from "zod";
import { MoneySchema } from "./money.schema";

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

export const DebtTypeSchema = z.enum([
  "mortgage",
  "consumer",
  "creditcard",
  "other",
  "other_short",
  "loan",
  "other_long",
]);

export const AmortizationTypeSchema = z.enum(["none", "direct", "indirect"]);

// Availability + Goal (neu)
export const AvailabilitySchema = z.enum(["instant", "3m_3y", "gt_3y", "locked"]);
export const GoalSchema = z.enum(["liq", "reinvest"]);

const InstrumentBaseSchema = {
  id: z.string().min(1),
  label: z.string().min(1),
};

// helper: accept both snake_case and camelCase on input, normalize to snake_case
const CashflowPaSchema = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v == null) return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  });

export const AssetInstrumentSchema = z.object({
  ...InstrumentBaseSchema,
  kind: z.literal("asset"),
  assetType: AssetTypeSchema,
  value: MoneySchema,

  // ---- NEW root fields (from DB columns) ----
  ui_id: z.string().optional(),
  availability: AvailabilitySchema.optional(),
  goal: GoalSchema.optional(),
  cashflow_pa: CashflowPaSchema,
  asset_class: AssetTypeSchema.optional(), // passt bei dir (real_estate etc.)
  notes: z.string().optional(),

  // keep meta_json allowed (only notes now)
  meta_json: z.any().optional(),
});

export const DebtInstrumentSchema = z.object({
  ...InstrumentBaseSchema,
  kind: z.literal("debt"),
  debtType: DebtTypeSchema,
  balance: MoneySchema,
  interestRate: z.number().min(0).max(100).optional(),
  amortization: z
    .object({
      type: AmortizationTypeSchema.default("none"),
      amountAnnual: MoneySchema.optional(),
    })
    .optional(),

  // ---- NEW root fields (from DB columns) ----
  ui_id: z.string().optional(),
  availability: AvailabilitySchema.optional(),
  notes: z.string().optional(),
  meta_json: z.any().optional(),
});

export const InstrumentSchema = z.discriminatedUnion("kind", [
  AssetInstrumentSchema,
  DebtInstrumentSchema,
]);
