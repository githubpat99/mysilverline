// lib/mapping/profileV2ToForecast.ts
//
// ForecastInput from ProfileV2.
// instruments => wealthToday
// annuals     => annualSpendingToday (+ optional otherIncomes later)
// events      => one-off spend events (narrowed)
import { getForecastInstruments } from "@/lib/forecast/instrumentsCompat";

import type {
  ProfileV2,
  Instrument,
  AssetInstrument,
  DebtInstrument,
  AnnualItem,
  Year,
} from "@/lib/types/v2";

import type { ForecastInput } from "@/lib/forecast/types";
import type { FinanceForecastBuild } from "@/lib/forecast/financeMapping";

import { ageAtJan1OfYear } from "@/lib/date/age";
import { clampInt } from "@/lib/forecast/financeMapping";
import { assumptionsFromGoal } from "@/lib/forecast/financeMapping"

// -----------------------------
// Type guards for instruments
// -----------------------------
function isAsset(i: Instrument): i is AssetInstrument {
  return i.kind === "asset";
}
function isDebt(i: Instrument): i is DebtInstrument {
  return i.kind === "debt";
}

// -----------------------------
// Annual helpers
// -----------------------------
function isActiveInYear(item: AnnualItem, year: Year): boolean {
  const start = (item.startYear ?? year) as Year; // default baseYear
  const end = (item.endYear ?? Infinity) as number;
  return year >= start && year <= end;
}

// -----------------------------
// Events: narrow to the variant that has "amount"
// We don't assume the union name. We narrow structurally.
// -----------------------------
type AnyEvent = ProfileV2["events"][number];

function hasAmount(e: AnyEvent): e is AnyEvent & { amount: number } {
  return typeof (e as any)?.amount === "number";
}
function hasYear(e: AnyEvent): e is AnyEvent & { year?: number } {
  const y = (e as any)?.year;
  return y === undefined || typeof y === "number";
}
function isOneTimeExpense(e: AnyEvent): e is AnyEvent & { type: "one_time_expense"; amount: number; year?: number } {
  return (e as any)?.type === "one_time_expense" && hasAmount(e) && hasYear(e);
}

// -----------------------------
// Builder
// -----------------------------
export function forecastInputFromProfileV2(
  profile: ProfileV2,
  opts?: {
    baseYear?: number; // default current year
    planToAge?: number; // optional override (absolute age)
    extraSafetyYears?: number; // default 0

  }
): FinanceForecastBuild {
  const baseYear = (opts?.baseYear ?? new Date().getFullYear()) as Year;

  // Phase C: birthDate not in v2 yet -> placeholder
  // Replace once v2 stores it.
  const birthDateISO = "1970-01-01";
  const selfAgeToday = ageAtJan1OfYear(birthDateISO, baseYear);
  if (selfAgeToday === null) {
    return { ok: false, error: "invalid_birthDate", message: "Geburtsdatum ist ungültig. Format YYYY-MM-DD." };
  }

  const self = profile.household.persons.find((p) => p.role === "self");
  const retireAtAge = clampInt(self?.retireAtAge ?? 65, 50, 75, 65);

  // -----------------------------
  // Horizon / planToAge
  // -----------------------------
  const meta: any = profile.meta ?? {};
  const horizonRawAny =
    meta.forecastHorizonYears ??
    meta.forecast_horizon_years ??
    null;

  const horizonRawNum =
    typeof horizonRawAny === "number" ? horizonRawAny : Number(String(horizonRawAny ?? "").trim());

  // Safety only (not a product rule): prevent absurd values from breaking charts
  const horizonYears = clampInt(
    Number.isFinite(horizonRawNum) && horizonRawNum > 0 ? horizonRawNum : 55,
    1,
    120,
    55
  );

  // If caller provides planToAge explicitly, it wins. Otherwise derive from horizon.
  const planToAgeDerived = selfAgeToday + horizonYears;

  // Safety only: keep within reasonable chart range
  const planToAge = clampInt(
    opts?.planToAge ?? planToAgeDerived,
    1,
    140,
    planToAgeDerived
  );

  const extraSafetyYears = clampInt(opts?.extraSafetyYears ?? 0, 0, 30, 0);

  // Wealth today
  const instruments = getForecastInstruments(profile);

// TEMP: tolerate both shapes
const assetsTotal = instruments
  .filter((i: any) => i?.kind === "asset")
  .reduce((acc, i: any) => acc + Number((i as any).value?.amount ?? (i as any).value ?? 0), 0);

const debtsTotal = instruments
  .filter((i: any) => i?.kind === "debt")
  .reduce((acc, i: any) => acc + Number((i as any).balance?.amount ?? (i as any).balance ?? (i as any).value?.amount ?? (i as any).value ?? 0), 0);

  const wealthToday = assetsTotal - debtsTotal;

  

  // One-off spending events
  const oneOffSpendEvents = (profile.events ?? [])
    .filter(isOneTimeExpense)
    .filter((e) => e.amount > 0)
    .map((e) => ({
      amount: e.amount,
      yearOffset: ((e.year ?? baseYear) - baseYear) as number,
    }));

  

  const assumptions = assumptionsFromGoal("balance" as any);

  const input: ForecastInput = {
    baseYear,
    selfAgeToday,

    wealthToday: Math.trunc(wealthToday),

    

    spendingExtraGrowth: 0,
    spendingAdjustments: [],
    oneOffSpendEvents,

    
    pensionsSelf: [],
    pensionsPartner: [],

    debts: [],

    retireAtAge,
    planToAge,
    extraSafetyYears,
  };

  return { ok: true, input, derived: { baseYear, selfAgeToday } };
}
