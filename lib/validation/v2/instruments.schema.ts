import { z } from "zod";
import { MoneySchema } from "./money.schema";

export const AssetTypeSchema = z.enum([
  "cash",
  "bank",
  "securities",
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

const InstrumentBaseSchema = {
  id: z.string().min(1),
  label: z.string().min(1),
};

export const AssetInstrumentSchema = z.object({
  ...InstrumentBaseSchema,
  kind: z.literal("asset"),
  assetType: AssetTypeSchema,
  value: MoneySchema,
});

export const DebtInstrumentSchema = z.object({
  ...InstrumentBaseSchema,
  kind: z.literal("debt"),
  debtType: DebtTypeSchema,
  balance: MoneySchema,
  interestRate: z.number().min(0).max(100).optional(),
});

export const InstrumentSchema = z.discriminatedUnion("kind", [
  AssetInstrumentSchema,
  DebtInstrumentSchema,
]);
