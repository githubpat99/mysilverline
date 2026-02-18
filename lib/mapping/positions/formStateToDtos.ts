import type { AssetPosition, DebtPosition } from "@/lib/types";
import type { AssetDTO, DebtDTO } from "@/lib/types/v2/positions.dto";

function toInt(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function clampInterestRatePct(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function assetTypeFromAssetClass(assetClass: any): string {
  const v = String(assetClass ?? "other");
  const allowed = new Set([
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
  return allowed.has(v) ? v : "other";
}

function normAccountKey(v: unknown): string | null {
  return typeof v === "string" && v.trim().length ? v : null;
}

export function formStep1ToAssetDtos(step1: any): AssetDTO[] {
  const positions: AssetPosition[] = Array.isArray(step1?.positions) ? step1.positions : [];

  return positions.map((p): AssetDTO => ({
    id: String(p.id),
    kind: "asset",
    label: String(p.label ?? "Position"),

    // API uses bucket/availability
    bucket: p.availability ?? null,
    goal: p.goal ?? null,

    assetType: assetTypeFromAssetClass(p.assetClass),
    valueCHF: toInt(p.amountChf),
    annualFlowCHF: p.cashflowPa == null ? null : toInt(p.cashflowPa),

    // persist routing keys (DTO wants string|null)
    source_account_key: normAccountKey(p.sourceAccountKey),
    target_account_key: normAccountKey(p.targetAccountKey),

    note: (p.notes ?? "")?.trim().length ? p.notes : null,
  }));
}

export function formStep2ToDebtDtos(step2: any): DebtDTO[] {
  const positions: DebtPosition[] = Array.isArray(step2?.positions) ? step2.positions : [];

  return positions.map((p): DebtDTO => {
    const amortPa = toInt((p as any).amortizationPaChf);

    return {
      id: String(p.id),
      kind: "debt",
      label: String(p.label ?? "Debt"),

      bucket: p.availability ?? null,
      availability: p.availability ?? null,

      debtType: String(p.debtType ?? "other"),
      valueCHF: toInt(p.balanceChf),

      interestRatePct: clampInterestRatePct(p.interestRatePct),

      // IMPORTANT: match PHP expectations (amortization object)
      // If you are currently removing amortization UI, amortPa will be 0 anyway.
      amortization:
        amortPa > 0
          ? {
              type: "direct", // keep simple for now; you said you'll handle indirect via events later
              amountAnnualCHF: amortPa,
              // optional: if you later want it, map from sourceAccountKey or a dedicated field
              // sourceInstrumentId: null,
            }
          : { type: "none" },

      // NEW: persist routing keys
      source_account_key: normAccountKey((p as any).sourceAccountKey),
      target_account_key: normAccountKey((p as any).targetAccountKey),

      note: (p.notes ?? "")?.trim().length ? p.notes : null,
    };
  });
}
