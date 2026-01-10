// lib/mapping/profileV2ToForecast.ts
//
// ForecastInput from ProfileV2.
// instruments => wealthToday
// annuals     => annualSpendingToday (+ optional otherIncomes later)
// events      => one-off spend events (narrowed)

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

function sumAnnual(items: AnnualItem[] | undefined, year: Year): number {
  if (!items?.length) return 0;
  return items
    .filter((x) => isActiveInYear(x, year))
    .reduce((acc, x) => acc + (x.amount ?? 0), 0);
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
    planToAge?: number; // default 95
    extraSafetyYears?: number; // default 0
    spendingIndexation?: ForecastInput["spendingIndexation"]; // default inflation
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

  const planToAge = clampInt(opts?.planToAge ?? 95, 70, 110, 95);
  const extraSafetyYears = clampInt(opts?.extraSafetyYears ?? 0, 0, 30, 0);

  // Wealth today
  const assetsTotal = profile.instruments.filter(isAsset).reduce((acc, i) => acc + i.value, 0);
  const debtsTotal = profile.instruments.filter(isDebt).reduce((acc, i) => acc + i.balance, 0);
  const wealthToday = assetsTotal - debtsTotal;

  // Annuals
  const annualIncomeToday = sumAnnual(profile.annuals?.income, baseYear);
  const annualSpendingToday = sumAnnual(profile.annuals?.need, baseYear);

  const idx = (opts?.spendingIndexation ?? "inflation") as ForecastInput["spendingIndexation"];

  // One-off spending events
  const oneOffSpendEvents = (profile.events ?? [])
    .filter(isOneTimeExpense)
    .filter((e) => e.amount > 0)
    .map((e) => ({
      amount: e.amount,
      yearOffset: ((e.year ?? baseYear) - baseYear) as number,
    }));

  // IMPORTANT:
  // You said IncomeLine currently comes from Lotto.
  // So we don't generate otherIncomes yet to avoid wrong type imports.
  // Once you introduce a forecast-specific Income type, fill it here.
  const otherIncomes: ForecastInput["otherIncomes"] = [];

  // Assumptions: goal not in v2 yet -> default
  const assumptions = assumptionsFromGoal("balance" as any);

  const input: ForecastInput = {
    baseYear,
    selfAgeToday,

    wealthToday: Math.trunc(wealthToday),

    annualSpendingToday,
    spendingIndexation: idx,

    spendingExtraGrowth: 0,
    spendingAdjustments: [],
    oneOffSpendEvents,

    otherIncomes,
    pensionsSelf: [],
    pensionsPartner: [],

    debts: [],

    assumptions,

    retireAtAge,
    planToAge,
    extraSafetyYears,
  };

  // Optional: if you still want annualIncome to flow in but don't have typed otherIncomes yet,
  // you can keep annualIncomeToday as derived info (not used by engine) or later add it to otherIncomes.
  // For now, engine uses annualSpendingToday; income can be introduced once IncomeLine type exists.

  return { ok: true, input, derived: { baseYear, selfAgeToday } };
}
