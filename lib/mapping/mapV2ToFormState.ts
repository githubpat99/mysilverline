// lib/mapping/mapV2ToFormState.ts
//
// Split mapping:
// - mapProfileV2ToFormStateBase(profile): base + step3 ONLY (no instruments)
// - mapPositionDtosToSteps(positionDtos): step1 + step2 ONLY
// - mapV2ToFormState(profile, positionDtos): compose both

import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";

import type {
  FormState,
  AssetPosition,
  DebtPosition,
  Availability,
  AssetClass,
  Goal,
} from "@/lib/types";

// ---------- helpers (reuse what you already have) ----------
function parseMeta(v: any): any {
  if (!v) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function isAvailability(v: any): v is Availability {
  return v === "instant" || v === "3m_3y" || v === "gt_3y" || v === "locked";
}

function isSystemAccountId(id: string): boolean {
  const s = String(id ?? "");
  return s.startsWith("sys_") || s === "liquidity" || s === "debt";
}

/** Normalize backend values (e.g. "short") to our Availability */
function normalizeAvailability(v: any): Availability {
  if (isAvailability(v)) return v;
  const s = String(v ?? "").toLowerCase();
  if (s === "short") return "3m_3y"; // short = kurzfristig (3m_3y)
  if (s === "long") return "gt_3y";
  return "3m_3y";
}

function isGoal(v: any): v is Goal {
  return v === "liq" || v === "reinvest";
}

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

function defaultAvailabilityFromAssetType(assetType: any): Availability {
  if (assetType === "cash" || assetType === "bank") return "instant";
  if (assetType === "securities") return "gt_3y";
  if (assetType === "real_estate") return "locked";
  return "gt_3y";
}

function debtTypeToForm(debtType: string): {
  debtType: DebtPosition["debtType"];
  availability: DebtPosition["availability"];
} {
  if (debtType === "mortgage") return { debtType: "mortgage", availability: "gt_3y" };
  if (debtType === "loan") return { debtType: "loan", availability: "gt_3y" };
  if (debtType === "consumer") return { debtType: "consumer", availability: "3m_3y" };
  if (debtType === "creditcard") return { debtType: "creditcard", availability: "instant" };

  if (debtType === "other_short") return { debtType: "other", availability: "3m_3y" };
  if (debtType === "other_long") return { debtType: "other", availability: "gt_3y" };

  return { debtType: "other", availability: "3m_3y" };
}

// ---------- 1) PROFILE ONLY (base + step3) ----------
export function mapProfileV2ToFormStateBase(profile: ProfileV2): Pick<FormState, "base" | "step3"> {
  const annualsV2 = profile.annualsV2 ?? { income: [], expense: [] };
  const events = profile.events ?? [];
  const self = profile.household?.persons?.find((p) => p.role === "self");

  return {
    base: {
      birthDate: self?.birthDate ?? "",
      retireAtAge: self?.retireAtAge ?? 65,
      forecastHorizonYears: profile.meta?.forecastHorizonYears ?? 55,
    },
    step3: {
      annualsV2: {
        income: annualsV2.income ?? [],
        expense: annualsV2.expense ?? [],
      },
      events,
    },
  };
}

// ---------- 2) POSITIONS ONLY (step1 + step2) ----------
/** Migration-on-read: ensure sys_overdraft exists when sys_liq_main is present */
function ensureSystemDebtIfNeeded(dtos: PositionDTO[]): PositionDTO[] {
  const hasLiq = dtos.some((x: any) => x?.kind === "asset" && String(x?.id) === "sys_liq_main");
  const hasOverdraft = dtos.some((x: any) => x?.kind === "debt" && String(x?.id) === "sys_overdraft");
  if (hasLiq && !hasOverdraft) {
    return [
      ...dtos,
      {
        id: "sys_overdraft",
        kind: "debt",
        label: "Überzug",
        bucket: "3m_3y",
        debtType: "overdraft",
        valueCHF: 0,
        interestRatePct: 10,
        amortization: { type: "none" },
        interestSourceInstrumentId: "sys_liq_main",
      } as PositionDTO,
    ];
  }
  return dtos;
}

export function mapPositionDtosToSteps(positionDtos: PositionDTO[] | null | undefined): Pick<FormState, "step1" | "step2"> {
  const rawDtos = Array.isArray(positionDtos) ? positionDtos : [];
  const dtos = ensureSystemDebtIfNeeded(rawDtos);

  // Backend kann kind als "asset", "asset:other", "debt", "debt:other" liefern
  const isAsset = (x: any) => x?.kind === "asset" || String(x?.kind ?? "").startsWith("asset");
  const isDebt = (x: any) => x?.kind === "debt" || String(x?.kind ?? "").startsWith("debt");
  const assetDtos = dtos.filter((x): x is Extract<PositionDTO, { kind: "asset" }> => isAsset(x));
  const debtDtos  = dtos.filter((x): x is Extract<PositionDTO, { kind: "debt"  }> => isDebt(x));

  const step1Positions: AssetPosition[] = assetDtos.map((a: any) => {
    const meta = parseMeta(a.meta_json);

    const rawAvail = a.bucket ?? a.availability ?? meta.availability;
    const assetType = a.assetType ?? a.asset_type;

    const availability: Availability =
      isAvailability(rawAvail) ? rawAvail : normalizeAvailability(rawAvail) ?? defaultAvailabilityFromAssetType(assetType);

    const rawGoal = a.goal ?? meta.goal;
    const goal: Goal = isGoal(rawGoal) ? rawGoal : "liq";

    const interestRatePct =
  typeof a.interestRatePct === "number" && Number.isFinite(a.interestRatePct)
    ? a.interestRatePct
    : typeof a.interestRate === "number" && Number.isFinite(a.interestRate)
      ? a.interestRate
      : undefined;

    const notes =
      typeof a.note === "string" ? a.note :
      typeof a.notes === "string" ? a.notes :
      typeof meta.notes === "string" ? meta.notes :
      "";

    return {
      id: String(a.id ?? a.instrument_id ?? a.ui_id),
      dbId: undefined, // optional; you can add if your DTO has dbId later
      label: String(a.label ?? "").trim() || (String(a.id ?? a.instrument_id) === "liquidity" ? "Liquidität" : "Position"),
      amountChf: toInt(a.valueCHF),
      currency: "CHF",
      availability,
      assetClass: assetClassFromAssetType(assetType),
      cashflowPa: toInt(a.annualFlowCHF ?? a.cashflow_pa ?? a.cashflowPa ?? 0),
      goal,
      notes,
    
      // NEW: routing keys (snake_case DTO -> camelCase FormState)
      sourceAccountKey: typeof a.source_account_key === "string" ? a.source_account_key : undefined,
      targetAccountKey: typeof a.target_account_key === "string" ? a.target_account_key : undefined,
      isSystem: !!(a.isSystem ?? a.is_system ?? isSystemAccountId(String(a.id ?? a.instrument_id ?? ""))),
    };
  });

  const step2Positions: DebtPosition[] = debtDtos
    .map((d: any): DebtPosition => {
      const meta = parseMeta(d.meta_json);

      const rawType = String(d.debtType ?? d.debt_type ?? "other");
      const mapped = debtTypeToForm(rawType === "overdraft" ? "other_short" : rawType);

      const interestRatePct =
        typeof d.interestRatePct === "number" && Number.isFinite(d.interestRatePct)
          ? d.interestRatePct
          : undefined;

      const a = d.amortization ?? null;

      const amortizationType: "none" | "direct" | "indirect" =
        a && (a.type === "direct" || a.type === "indirect") ? a.type : "none";

      const amortizationPaChf =
        a && typeof a.amountAnnualCHF === "number" && Number.isFinite(a.amountAnnualCHF)
          ? Math.trunc(a.amountAnnualCHF)
          : 0; 

      const notes =
        typeof d.note === "string" ? d.note :
        typeof d.notes === "string" ? d.notes :
        typeof meta.notes === "string" ? meta.notes :
        "";

      return {
        id: String(d.id ?? d.instrument_id ?? d.ui_id),
        label: (String(d.label ?? "").trim() || (String(d.id ?? d.instrument_id) === "debt" ? "Überzug" : "")) || "Schuld",
        balanceChf: toInt(d.valueCHF ?? d.amount_chf ?? d.balanceCHF),
        currency: "CHF",
        availability: normalizeAvailability(d.bucket ?? d.availability),
        debtType: mapped.debtType,
        interestRatePct,
        amortizationPaChf,
        notes,
      // NEW: Quelle – wenn Backend leer, bleibt undefined → Step2Form setzt Default Liquidität
        sourceAccountKey: (() => {
          const raw = typeof d.source_account_key === "string" ? d.source_account_key : (d as any).interest_source_instrument_id;
          if (!raw || !String(raw).trim()) return undefined;
          const s = String(raw).trim();
          return s.startsWith("asset:") ? s : `asset:${s}`;
        })(),
        targetAccountKey: typeof d.target_account_key === "string" ? d.target_account_key : undefined,
        isSystem: !!(d.isSystem ?? d.is_system ?? isSystemAccountId(String(d.id ?? d.instrument_id ?? ""))),
      };
    })
    .filter((p) => {
      // Systemkonten (sys_*) immer anzeigen
      if (String(p.id).startsWith("sys_")) return true;
      return p.balanceChf !== 0 || p.label.trim().length > 0;
    });

  return {
    step1: { positions: step1Positions },
    step2: { positions: step2Positions },
  };
}

// ---------- 3) COMPOSE ----------
export function mapV2ToFormState(profile: ProfileV2, positionDtos: PositionDTO[]): FormState {
  const base = mapProfileV2ToFormStateBase(profile);
  const steps = mapPositionDtosToSteps(positionDtos);

  return {
    base: base.base,
    step1: steps.step1,
    step2: steps.step2,
    step3: base.step3,
  };
}
