export type IndexationMode = "inflation" | "fixed_nominal" | "fixed_real";

/**
 * Apply indexation for a value over dt years.
 * - inflation: grows with (inflation + extraGrowth)
 * - fixed_real: grows with inflation only
 * - fixed_nominal: unchanged
 */
export function applyIndexation(
  amount: number,
  mode: IndexationMode,
  inflation: number,
  dtYears: number,
  extraGrowth = 0,
): number {
  if (dtYears <= 0) return amount;

  if (mode === "inflation") {
    return amount * Math.pow(1 + inflation + extraGrowth, dtYears);
  }
  if (mode === "fixed_real") {
    return amount * Math.pow(1 + inflation, dtYears);
  }
  return amount; // fixed_nominal
}

export function indexationFactor(
  mode: IndexationMode,
  inflation: number,
  dtYears: number,
  extraGrowth = 0,
): number {
  if (dtYears <= 0) return 1;

  if (mode === "inflation") return Math.pow(1 + inflation + extraGrowth, dtYears);
  if (mode === "fixed_real") return Math.pow(1 + inflation, dtYears);
  return 1; // fixed_nominal
}
