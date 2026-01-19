// ================================
// file: src/lib/forecast/computeForecast.ts
// ================================

import { applyExpenses } from "../expenses/applyExpenses";
import { applyIncome } from "../income/applyIncome";
import { applyDebtsDetailed } from "@/lib/forecast/debts/applyDebts";
import type { YearBreakdown } from "../breakdown/types";
import type { ForecastResult, ForecastInput, ForecastPoint } from "../types";
import { buildExpensesLines } from "../expenses/applyExpensesBreakdown";
import { buildIncomeLines } from "../income/applyIncomeBreakdown";
import { buildDebtLines } from "../debts/applyDebtsBreakdown";
import { sumEventsForYearDetailed } from "../events/sumEventsForYearDetailed";

// ---- helpers ----
function n(v: unknown, fallback = 0): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
}

type ForecastRow = {
  year: number;

  // END of year
  liq: number;
  shortA: number;
  longA: number;
  realA: number;

  shortD: number;
  longD: number;

  // START of year (neu)
  start: {
    liq: number;
    shortA: number;
    longA: number;
    realA: number;
    shortD: number;
    longD: number;
  };

  // explanation
  netFlow: number;
  assetCF: number;
  events: number;

  // NEW: debt details
  debtInterest: number;
  debtAmort: number;

  // NEW
  assetCashflowToLiq: number;
  assetCashflowReinvest: number;

};

// Assets/Debts buckets used by the UI
type AssetBuckets = { liq: number; shortA: number; longA: number; realA: number };
type DebtBuckets = { shortD: number; longD: number };

function cloneAssets(a: AssetBuckets): AssetBuckets {
  return { liq: a.liq, shortA: a.shortA, longA: a.longA, realA: a.realA };
}
function cloneDebts(d: DebtBuckets): DebtBuckets {
  return { shortD: d.shortD, longD: d.longD };
}

function sumAssets(a: AssetBuckets): number {
  return n(a.liq) + n(a.shortA) + n(a.longA) + n(a.realA);
}
function sumDebts(d: DebtBuckets): number {
  return n(d.shortD) + n(d.longD);
}

// cover negative liquidity by drawing down other asset buckets
function coverLiquidityDeficit(a: AssetBuckets) {
  if (a.liq >= 0) return;

  let deficit = -a.liq;

  const draw = (key: keyof AssetBuckets) => {
    if (deficit <= 0) return;
    const avail = Math.max(0, n(a[key]));
    const take = Math.min(avail, deficit);
    if (take > 0) {
      a[key] = avail - take;
      deficit -= take;
      a.liq += take;
    }
  };

  draw("shortA");
  draw("longA");
  draw("realA");
  // if still negative after exhausting all assets: stays negative (insolvency)
}

export function computeForecast(input: ForecastInput): ForecastPoint[] {
  return computeForecastWithBreakdown(input).points;
}

/**
 * Extended: also tracks end-of-year asset/debt buckets and exposes them via:
 * - breakdowns[*].assetsEnd / debtsEnd (as any, to avoid breaking existing type file)
 * - result.rows (for your ForecastTableNice)
 */
export function computeForecastWithBreakdown(input: ForecastInput): ForecastResult {
  const {
    selfAgeToday,
    wealthToday,
    annualSpendingToday,
    spendingIndexation, // IndexationMode (string/enum) -> do NOT numeric-guard with n()
    spendingExtraGrowth = 0,
    spendingAdjustments = [],
    oneOffSpendEvents = [],
    otherIncomes = [],
    pensionsSelf = [],
    pensionsPartner = [],
    debts = [],
    assumptions,
    planToAge,
    extraSafetyYears = 0,

    // NEW (optional)
    baseYear,
    events = [],

    // NEW (optional, recommended): explicit buckets from profile mapping
    assetsToday, // { liq, shortA, longA, realA }
    debtsToday,  // { shortD, longD }
  } = input as any;

  // ---- numeric guards ----
  const selfAgeTodayN = n(selfAgeToday);
  const wealthTodayN = n(wealthToday);
  const annualSpendingTodayN = n(annualSpendingToday);
  const spendingExtraGrowthN = n(spendingExtraGrowth);

  const inflationN = n(assumptions?.inflation);

  const nominalReturnN =
    assumptions?.returnMode === "nominal"
      ? n(assumptions?.nominalReturn)
      : n(assumptions?.realReturn) + inflationN;

  const annualFeesN = n(assumptions?.annualFees);
  const g = Math.max(-0.99, nominalReturnN - annualFeesN);

  const horizonYears = Math.max(0, n(planToAge) + n(extraSafetyYears) - selfAgeTodayN);

  // ---- initial buckets ----
  const assets: AssetBuckets = {
    liq: n(assetsToday?.liq, 0),
    shortA: n(assetsToday?.shortA, 0),
    longA: n(assetsToday?.longA, 0),
    realA: n(assetsToday?.realA, 0),
  };

  const debtBuckets: DebtBuckets = {
    shortD: n(debtsToday?.shortD, 0),
    longD: n(debtsToday?.longD, 0),
  };

  // keep a "net worth" for compatibility with previous logic
  let wealth = Math.trunc(sumAssets(assets) - sumDebts(debtBuckets));

  const points: ForecastPoint[] = [];
  const breakdowns: YearBreakdown[] = [];

  // rows for ForecastTableNice (added property; returned via `as any` to avoid type churn)
  const rows: ForecastRow[] = [];


  for (let t = 0; t <= horizonYears; t++) {
    const age = selfAgeTodayN + t;
    const year = n(baseYear, 0) > 0 ? n(baseYear) + t : (input as any)?.meta?.startYear
      ? n((input as any).meta.startYear) + t
      : (n((input as any).startYear, 0) > 0 ? n((input as any).startYear) + t : 0);

    // snapshot start states
    const assetsStart = cloneAssets(assets);
    const debtsStart = cloneDebts(debtBuckets);
    const assetCashflowToLiq = n((input as any).assetCashflowToLiq, 0);
    const assetCashflowReinvest =
      ((input as any).assetCashflowReinvest as { shortA: number; longA: number; realA: number }) ?? {
        shortA: 0,
        longA: 0,
        realA: 0,
      };
    const assetCashflowReinvestTotal =
      n(assetCashflowReinvest.shortA) + n(assetCashflowReinvest.longA) + n(assetCashflowReinvest.realA);


    const wealthStart = wealth;

    const expensesBase = n(
      applyExpenses({
        t,
        age,
        annualSpendingToday: annualSpendingTodayN,
        spendingIndexation, // keep original mode/enum
        inflation: inflationN,
        spendingExtraGrowth: spendingExtraGrowthN,
        spendingAdjustments,
        oneOffSpendEvents,
      })
    );

    const incomeBase = n(
      applyIncome({
        t,
        age,
        inflation: inflationN,
        otherIncomes,
        pensionsSelf,
        pensionsPartner,
      })
    );

    const debtYear = applyDebtsDetailed({ debts });

    if (t === 0) {
      console.log("[FC] debts mapped", debts);
      console.log("[FC] debtYear", debtYear);
    }




    const eventResult = sumEventsForYearDetailed({
      events,
      baseYear,
      yearIndex: t,
      inflation: inflationN,
    });

    const eventsIncome = n(eventResult.incomeCHF);
    const eventsExpense = n(eventResult.expenseCHF);
    const eventsNet = eventsIncome - eventsExpense;


    const expensesTotal = n(expensesBase + eventsExpense);
    const totalExpenses =
      expensesTotal +
      debtYear.interest +
      debtYear.amort;

    let a = n(debtYear.amort);
    const payShort = Math.min(n(debtBuckets.shortD), a);
    debtBuckets.shortD = Math.max(0, n(debtBuckets.shortD) - n(debtYear.amortShort));
    debtBuckets.longD = Math.max(0, n(debtBuckets.longD) - n(debtYear.amortLong));

    if (t === 0) console.log("[FC] debtYear after map", debtYear);


    // Reinvest erhöht Asset-Buckets (nicht LIQ)
    assets.shortA = n(assets.shortA) + n(assetCashflowReinvest.shortA);
    assets.longA = n(assets.longA) + n(assetCashflowReinvest.longA);
    assets.realA = n(assets.realA) + n(assetCashflowReinvest.realA);

    // To LIQ ist Income (geht in net)
    const incomeTotal = n(incomeBase + eventsIncome + assetCashflowToLiq);


    const net = n(incomeTotal - totalExpenses);

    // ---- cashflow routing ----
    // default: all net flow hits liquidity
    assets.liq = n(assets.liq) + net;

    // if liquidity < 0: fund it from short/long/real
    coverLiquidityDeficit(assets);

    // ---- asset return (apply to invested/locked buckets) ----
    const investBase = n(assets.shortA) + n(assets.longA) + n(assets.realA);

    assets.shortA = Math.trunc(n(assets.shortA) * (1 + g));
    assets.longA = Math.trunc(n(assets.longA) * (1 + g));
    assets.realA = Math.trunc(n(assets.realA) * (1 + g));

    const investAfter = n(assets.shortA) + n(assets.longA) + n(assets.realA);
    const assetCF = investAfter - investBase; // approx. return effect

    // ---- recompute wealth ----
    wealth = Math.trunc(sumAssets(assets) - sumDebts(debtBuckets));
    const wealthEnd = wealth;

    // ---- breakdown lines ----
    const incomeLines = [
      ...buildIncomeLines({
        t,
        age,
        inflation: inflationN,
        otherIncomes,
        pensionsSelf,
        pensionsPartner,
        totalCHF: incomeBase,
      }).lines,
      ...eventResult.incomeLines,
    ];

    const expenseLines = [
      ...buildExpensesLines({
        t,
        age,
        annualSpendingToday: annualSpendingTodayN,
        spendingIndexation,
        inflation: inflationN,
        spendingExtraGrowth: spendingExtraGrowthN,
        spendingAdjustments,
        oneOffSpendEvents,
        totalCHF: expensesBase,
      }).lines,
      ...eventResult.expenseLines,
    ];

    const debtLines = buildDebtLines({
      debts,
      totalCHF: debtYear.interest, // Lines zeigen Zinsen (wie bisher)
    }).lines;

    // ---- points (keep compatible shape) ----
    points.push({
      yearIndex: t,
      age,
      wealth: wealthStart,
      income: incomeTotal,
      expenses: totalExpenses,
    });

    // ---- breakdowns (extended with buckets via any) ----
    breakdowns.push({
      yearIndex: t,
      age,
      wealthStart,
      wealthEnd,
      income: incomeLines,
      expenses: expenseLines,
      debts: debtLines,
      totals: {
        income: incomeTotal,
        expenses: expensesTotal, // base+events (without debt interest)
        debts: debtYear.interest, // Zinsen
        debtsAmort: debtYear.amort, // neu (optional, aber sinnvoll)
        net,
        eventsIncome,
        eventsExpense,
        eventsNet,
        assetCF,
        assetCashflowToLiq,
        assetCashflowReinvest:
          n(assetCashflowReinvest.shortA) +
          n(assetCashflowReinvest.longA) +
          n(assetCashflowReinvest.realA),
      } as any,
      events: {
        incomeLines: eventResult.incomeLines,
        expenseLines: eventResult.expenseLines,
      },

      // EXTENSIONS (not in type yet)
      assetsStart,
      assetsEnd: cloneAssets(assets),
      debtsStart,
      debtsEnd: cloneDebts(debtBuckets),
      year,
    } as any);

    // ---- rows (for ForecastTableNice) ----
    rows.push({
      year: year || (n((input as any)?.meta?.startYear, 0) ? n((input as any).meta.startYear) + t : t),

      liq: n(assets.liq),
      shortA: n(assets.shortA),
      longA: n(assets.longA),
      realA: n(assets.realA),
      shortD: n(debtBuckets.shortD),
      longD: n(debtBuckets.longD),

      start: {
        liq: n(assetsStart.liq),
        shortA: n(assetsStart.shortA),
        longA: n(assetsStart.longA),
        realA: n(assetsStart.realA),
        shortD: n(debtsStart.shortD),
        longD: n(debtsStart.longD),
      },

      debtInterest: debtYear.interest,
      debtAmort: debtYear.amort,

      assetCashflowToLiq,
      assetCashflowReinvest: assetCashflowReinvestTotal,

      netFlow: net,
      assetCF,
      events: eventsNet,
    });

  }

  return { points, breakdowns, rows } as any;
}
