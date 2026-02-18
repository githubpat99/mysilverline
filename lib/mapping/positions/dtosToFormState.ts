import type { FormState, AssetPosition, DebtPosition, Availability, AssetClass } from "@/lib/types";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";

function toInt(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function assetClassFromAssetType(t: any): AssetClass {
  if (t === "cash") return "cash";
  if (t === "bank") return "bank";
  if (t === "securities") return "securities";
  if (t === "real_estate") return "real_estate";
  if (t === "gold") return "gold";
  if (t === "crypto") return "crypto";
  if (t === "p2p") return "p2p";
  if (t === "pension") return "pension";
  return "other";
}

function debtTypeToForm(debtType: string): { debtType: DebtPosition["debtType"]; availability: Availability } {
  if (debtType === "mortgage") return { debtType: "mortgage", availability: "gt_3y" };
  if (debtType === "loan") return { debtType: "loan", availability: "gt_3y" };
  if (debtType === "consumer") return { debtType: "consumer", availability: "3m_3y" };
  if (debtType === "creditcard") return { debtType: "creditcard", availability: "instant" };
  if (debtType === "other_short") return { debtType: "other", availability: "3m_3y" };
  if (debtType === "other_long") return { debtType: "other", availability: "gt_3y" };
  return { debtType: "other", availability: "3m_3y" };
}

export function applyPositionDtosToFormState(base: FormState, dtos: PositionDTO[]): FormState {
  const assets = dtos.filter((x) => x.kind === "asset");
  const debts = dtos.filter((x) => x.kind === "debt");

  const step1Positions: AssetPosition[] = assets.map((a: any) => ({
    id: String(a.id),
    dbId: undefined, // optional: wenn du server-id separat führst
    label: String(a.label ?? "Position"),
    amountChf: toInt(a.valueCHF),
    currency: "CHF",
    availability: (a.bucket ?? "instant"),
    assetClass: assetClassFromAssetType(a.assetType),
    cashflowPa: toInt(a.annualFlowCHF ?? 0),
    goal: "liq",
    notes: typeof a.note === "string" ? a.note : "",
  }));

  const step2Positions: DebtPosition[] = debts.map((d: any) => {
    const mapped = debtTypeToForm(String(d.debtType ?? "other"));
    const a = d.amortization ?? null;

    return {
      id: String(d.id),
      label: String(d.label ?? ""),
      balanceChf: toInt(d.valueCHF),
      currency: "CHF",
      availability: (d.bucket ?? mapped.availability),
      debtType: mapped.debtType,
      interestRatePct: d.interestRatePct ?? undefined,
      amortizationType: a && a.type !== "none" ? a.type : "none",
      amortizationPaChf: a && a.amountAnnualCHF ? toInt(a.amountAnnualCHF) : 0,
      // optional: später
      // amortizationSourceInstrumentId: a?.sourceInstrumentId ?? undefined,
      notes: typeof d.note === "string" ? d.note : "",
    };
  });

  return {
    ...base,
    step1: { ...(base.step1 as any), positions: step1Positions },
    step2: { ...(base.step2 as any), positions: step2Positions },
  };
}
