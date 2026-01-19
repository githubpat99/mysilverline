import type { ProfileV2 } from "@/lib/types/v2";
import type {
  FormState,
  AssetPosition,
  DebtPosition,
  Availability,
  AssetClass,
  Goal,
} from "@/lib/types";
import type { Instrument } from "@/lib/types/v2";
import type { DebtInstrument } from "@/lib/types/v2/instruments";

// ---------- helpers ----------
function parseMeta(v: any): any {
  if (!v) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function defaultAvailabilityFromAssetType(assetType: any): Availability {
  if (assetType === "cash" || assetType === "bank") return "instant";
  if (assetType === "securities") return "gt_3y";
  if (assetType === "real_estate") return "locked";
  return "gt_3y";
}

function normalizeAssetClass(assetType: any): AssetClass {
  if (assetType === "cash") return "cash";
  if (assetType === "bank") return "bank";
  if (assetType === "securities") return "securities";
  if (assetType === "real_estate") return "real_estate";
  if (assetType === "gold") return "gold";
  if (assetType === "crypto") return "crypto";
  if (assetType === "p2p") return "p2p";
  if (assetType === "pension") return "pension";
  return "other";
}

function isAvailability(v: any): v is Availability {
  // locked removed; keep backward compatible if old data still has it
  return v === "instant" || v === "3m_3y" || v === "gt_3y" || v === "locked";
}

function isGoal(v: any): v is Goal {
  return v === "liq" || v === "reinvest";
}

function toInt(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function moneyToInt(m: any): number {
  // Money is effectively number in your codebase, but be defensive
  if (typeof m === "number" && Number.isFinite(m)) return Math.trunc(m);
  if (m && typeof m.amount === "number" && Number.isFinite(m.amount)) return Math.trunc(m.amount);
  return 0;
}

function toAssetPosition(i: any): AssetPosition {
  const meta = parseMeta(i.meta_json);

  const assetType = i.assetType ?? i.asset_type;

  // availability: DB/root is SoT, meta_json only legacy fallback
  const rawAvail = i.availability ?? meta.availability;
  const availability: Availability =
    isAvailability(rawAvail) ? rawAvail : defaultAvailabilityFromAssetType(assetType);

  // goal: DB/root is SoT, meta_json only legacy fallback
  const rawGoal = i.goal ?? meta.goal;
  const goal: Goal = isGoal(rawGoal) ? rawGoal : "liq";

  // stable UI id preferred (ui_id column), then legacy uiId in meta, then instrument id
  const id = String(i.ui_id ?? i.uiId ?? meta.uiId ?? i.id);

  // cashflow_pa: DB/root is SoT; camelCase fallback for older payloads; no meta_json fallback anymore
  const cashflowPa =
    i.cashflow_pa != null ? toInt(i.cashflow_pa)
    : i.cashflowPa != null ? toInt(i.cashflowPa)
    : 0;

  // asset_class: DB/root preferred, meta_json legacy fallback
  const assetClassRaw = i.asset_class ?? i.assetClass ?? meta.assetClass;

  // DB id (if your API provides it); keep legacy fallback
  const dbIdCandidate =
    (typeof i.dbId === "number" ? i.dbId : undefined) ??
    (typeof i.db_id === "number" ? i.db_id : undefined) ??
    (typeof meta.dbId === "number" ? meta.dbId : undefined);

  // notes: root preferred; meta_json legacy fallback
  const notes =
    typeof i.notes === "string"
      ? i.notes
      : typeof meta.notes === "string"
        ? meta.notes
        : "";

  return {
    id,
    dbId: dbIdCandidate,
    label: String(i.label ?? "Position"),
    amountChf: moneyToInt(i.value ?? i.amount_chf ?? i.amountChf),
    currency: "CHF",
    availability,
    assetClass: (assetClassRaw as AssetClass) ?? normalizeAssetClass(assetType),
    cashflowPa,
    goal,
    notes,
  };
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

// ---------- main ----------
export function mapV2ToFormState(profile: ProfileV2): FormState {
  const instruments = Array.isArray(profile.instruments) ? profile.instruments : [];

  // ---- STEP 1: Assets -> positions[] ----
  const assetInstruments = instruments.filter((i: any) => i?.kind === "asset");
  const positions: AssetPosition[] = assetInstruments.map(toAssetPosition);

  // ---- STEP 2: Debts -> positions[] ----
  const debtInstruments: DebtInstrument[] = instruments.filter(
    (i: any): i is DebtInstrument => i?.kind === "debt"
  );

  const debtPositions: DebtPosition[] = debtInstruments
    .map((d): DebtPosition => {
      const meta = parseMeta((d as any).meta_json);

      const mapped = debtTypeToForm(String((d as any).debtType ?? (d as any).debt_type ?? "other"));

      const interestRatePct =
        typeof (d as any).interestRate === "number" && Number.isFinite((d as any).interestRate)
          ? (d as any).interestRate
          : undefined;

      const amort = (d as any).amortization as
        | { type?: "none" | "direct" | "indirect"; amountAnnual?: number }
        | undefined;

      const amortizationType: "none" | "direct" | "indirect" =
        amort?.type === "direct" || amort?.type === "indirect" ? amort.type : "none";

      const amortizationPaChf =
        typeof amort?.amountAnnual === "number" && Number.isFinite(amort.amountAnnual)
          ? Math.trunc(amort.amountAnnual)
          : 0;

      const id = String((d as any).ui_id ?? (d as any).uiId ?? meta.uiId ?? (d as any).id);

      return {
        id,
        label: String((d as any).label ?? ""),
        balanceChf: moneyToInt((d as any).balance ?? (d as any).amount_chf),
        currency: "CHF",
        availability: (d as any).availability ?? mapped.availability,
        debtType: (d as any).debt_type ?? (d as any).debtType ?? mapped.debtType,
        interestRatePct,
        amortizationType,
        amortizationPaChf,
        notes: typeof (d as any).notes === "string" ? (d as any).notes : (typeof meta.notes === "string" ? meta.notes : ""),
      };
    })
    .filter((p) => p.balanceChf !== 0 || p.label.trim().length > 0);



  // ---- STEP 3: Annuals / Events ----
  const annualsV2 = profile.annualsV2 ?? { income: [], expense: [] };
  const events = profile.events ?? [];

  const self = profile.household?.persons?.find((p) => p.role === "self");

  return {
    base: {
      birthDate: self?.birthDate ?? "",
      retireAtAge: self?.retireAtAge ?? 65,
      forecastHorizonYears: profile.meta?.forecastHorizonYears ?? 55,
    },

    step1: { positions },

    step2: { positions: debtPositions },

    step3: {
      annualsV2: {
        income: annualsV2.income ?? [],
        expense: annualsV2.expense ?? [],
      },
      events,
    },
  };
}
