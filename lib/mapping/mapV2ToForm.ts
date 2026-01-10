import type { ProfileV2 } from "@/lib/types/v2";
import type { FormState } from "@/lib/types";
import type { Instrument, AssetInstrument, DebtInstrument } from "@/lib/types/v2";
import type { Year } from "@/lib/types/v2"; // falls Year dort exportiert ist; sonst aus money importieren
import { UI_EVT } from "./mapFormStateToProfileV2";

function moneyToNumber(m: unknown): number {
  if (typeof m === "number" && Number.isFinite(m)) return m;
  if (m && typeof m === "object") {
    const anyM = m as any;
    if (typeof anyM.cents === "number" && Number.isFinite(anyM.cents)) return anyM.cents / 100;
    if (typeof anyM.value === "number" && Number.isFinite(anyM.value)) return anyM.value;
  }
  return 0;
}

function toStr(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n));
}

function isAsset(i: Instrument): i is AssetInstrument {
  return i.kind === "asset";
}

function isDebt(i: Instrument): i is DebtInstrument {
  return i.kind === "debt";
}

function isActiveInYear(item: { startYear?: Year; endYear?: Year }, year: Year): boolean {
  const startsOk = item.startYear == null || item.startYear <= year;
  const endsOk = item.endYear == null || item.endYear >= year;
  return startsOk && endsOk;
}

function sumAnnual(items: Array<{ amount: number; startYear?: Year; endYear?: Year }>, year: Year): number {
  return (items ?? [])
    .filter((it) => isActiveInYear(it, year))
    .reduce((acc, it) => acc + moneyToNumber(it.amount), 0);
}

// ---- Events helpers (new v2 event model) ----
function yearFromISO(dateISO: string): number {
  const y = Number((dateISO ?? "").slice(0, 4));
  return Number.isFinite(y) ? y : 0;
}

function sumOneTimeEventsFromYear(
  events: any[],
  baseYear: Year,
  lineType: "income" | "spending"
): number {
  return (events ?? [])
    .filter((e) => e && typeof e === "object")
    .filter((e) => e.active === 1 || e.active === true)
    .filter((e) => e.recurrence === "none")
    .filter((e) => yearFromISO(String(e.start_date ?? "")) >= baseYear)
    .filter((e) => e.line && typeof e.line === "object" && e.line.line_type === lineType)
    .reduce((acc, e) => acc + Number(e.line.amount_chf ?? 0), 0);
}

export function mapV2ToFormState(p: ProfileV2): FormState {

  console.log("[mapV2ToFormState] annuals from API", p.annuals);              // TODO PIN entfernen
console.log("[mapV2ToFormState] annuals.indexation", p.annuals?.indexation);  // TODO PIN entfernen


  const self = p.household.persons.find((x) => x.role === "self");

  // BaseYear: aus meta.startYear – fallback auf aktuelles Jahr
  const baseYear: Year = (p.meta?.startYear ?? new Date().getFullYear()) as Year;

  const sumAssets = (assetType: "cash" | "bank" | "securities" | "other") =>
    (p.instruments ?? [])
      .filter(isAsset)
      .filter((i) => i.assetType === assetType)
      .reduce((acc, i) => acc + moneyToNumber(i.value), 0);

  const sumDebts = (
    debtType:
      | "mortgage"
      | "consumer"
      | "creditcard"
      | "other_short"
      | "loan"
      | "other_long"
  ) =>
    (p.instruments ?? [])
      .filter(isDebt)
      .filter((i) => i.debtType === debtType)
      .reduce((acc, i) => acc + moneyToNumber(i.balance), 0);

  // New v2 events: compute "one-time" totals for Step3 legacy fields
  const oneTimeIncome = sumOneTimeEventsFromYear(p.events as any[], baseYear, "income");
  const oneTimeExpense = sumOneTimeEventsFromYear(p.events as any[], baseYear, "spending");

  // --- Annuals → v1 totals (heute) ---
  const annualIncomeToday = sumAnnual(p.annuals?.income ?? [], baseYear);
  const annualSpendingToday = sumAnnual(p.annuals?.need ?? [], baseYear);

  const idx = p.annuals?.indexation ?? "fixed_nominal";

  const futureNotes =
    (p.events ?? []).find((e) => e.client_id === UI_EVT.futureIncome)?.meta_json?.notes ??
    (p.events ?? []).find((e) => e.client_id === UI_EVT.futureExpense)?.meta_json?.notes ??
    "";

  const next = {
    step1: {
      birthDate: self?.birthDate ?? "",
      retireAtAge: self?.retireAtAge ?? 65,
      cash: toStr(sumAssets("cash")),
      bankSavings: toStr(sumAssets("bank")),
      securities: toStr(sumAssets("securities")),
      otherInvest: toStr(sumAssets("other")),
    },
    step2: {
      creditCard: toStr(sumDebts("creditcard")),
      consumerLoan: toStr(sumDebts("consumer")),
      otherShort: toStr(sumDebts("other_short")),
      mortgage: toStr(sumDebts("mortgage")),
      loan: toStr(sumDebts("loan")),
      otherLong: toStr(sumDebts("other_long")),
    },
    step3: {
      annualIncomeToday: toStr(annualIncomeToday),
      annualSpendingToday: toStr(annualSpendingToday),
      indexation: idx,
      events: p.events ?? [],
    },
    step4: {
      goal: "",
      risk: 0,
      horizonYears: 5,
    },
    step5: { preferred: [], avoided: [] },
    step6: { minLiquidity: "", monthlySaving: "" },
  } satisfies FormState;

  return next;
}
