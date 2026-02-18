import { z } from "zod";

export const MoneySchema = z.number().finite();
export const YearSchema = z.number().int().min(1900).max(2200);
export const AgeSchema = z.number().int().min(0).max(120);
export const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
