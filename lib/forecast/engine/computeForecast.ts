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

  // NEW: transfers (explicit, for UI)
  transferAmortFrom: { liq: number; shortA: number; longA: number; realA: number };
  // optional: falls du Rebalancing separat zeigen willst
  coverDeficitFrom: { shortA: number; longA: number; realA: number };
  transferInterestFrom: { liq: number; shortA: number; longA: number; realA: number };

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

type AssetDraw = { liq: number; shortA: number; longA: number; realA: number };

function emptyDraw(): AssetDraw {
  return { liq: 0, shortA: 0, longA: 0, realA: 0 };
}

// deckt NUR ein negatives liq (Rebalancing), tracked die Quelle
function coverLiquidityDeficitTracked(a: AssetBuckets): AssetDraw {
  const drawRec = emptyDraw();
  if (a.liq >= 0) return drawRec;

  let deficit = -a.liq;

  const draw = (key: keyof AssetBuckets) => {
    if (deficit <= 0) return;
    const avail = Math.max(0, n(a[key]));
    const take = Math.min(avail, deficit);
    if (take > 0) {
      a[key] = avail - take;
      deficit -= take;
      a.liq += take;
      (drawRec as any)[key] += take;
    }
  };

  draw("shortA");
  draw("longA");
  draw("realA");
  return drawRec;
}

// “Payment” aus Assets: zuerst LIQ, dann short/long/real; liq wird nie negativ
function payFromAssetsTracked(a: AssetBuckets, amountCHF: number): AssetDraw {
  const drawRec = emptyDraw();
  let remaining = Math.max(0, Math.trunc(amountCHF));
  if (remaining <= 0) return drawRec;

  // 1) LIQ
  const liqAvail = Math.max(0, n(a.liq));
  const takeLiq = Math.min(liqAvail, remaining);
  if (takeLiq > 0) {
    a.liq = liqAvail - takeLiq;
    remaining -= takeLiq;
    drawRec.liq += takeLiq;
  }

  // 2) dann short/long/real
  const draw = (key: keyof AssetBuckets) => {
    if (remaining <= 0) return;
    const avail = Math.max(0, n(a[key]));
    const take = Math.min(avail, remaining);
    if (take > 0) {
      a[key] = avail - take;
      remaining -= take;
      (drawRec as any)[key] += take;
    }
  };

  draw("shortA");
  draw("longA");
  draw("realA");

  return drawRec;
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
    debtsToday, // { shortD, longD }
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

  // ---------------- debt state (per debt, different rates inside buckets) ----------------
  type DebtTerm = "short" | "long";
  type DebtState = {
    id: string;
    term: DebtTerm;
    principal: number; // remaining principal
    ratePct: number; // annual interest rate in percent, e.g. 2.5 (=2.5%), 0.1 (=10% per your current data)
  };

  const inferDebtTerm = (d: any): DebtTerm => {
    const term = String(d?.term ?? "").toLowerCase();
    if (term === "short" || term === "long") return term as DebtTerm;

    const av = String(d?.availability ?? d?.bucket ?? d?.termBucket ?? "").toLowerCase();
    if (av.includes("instant") || av.includes("3m") || av.includes("short")) return "short";
    if (av.includes("gt_3y") || av.includes("long")) return "long";
    return "long";
  };

  const extractPrincipal = (d: any): number => {
    const p =
      d?.principalToday ??
      d?.balance ??
      d?.principal ??
      d?.valueCHF ??
      d?.value ??
      d?.amount ??
      d?.chf ??
      0;
    return Math.trunc(n(p, 0));
  };

  // IMPORTANT: keep CURRENT semantics:
  // - your interest rate is stored as a decimal rate (0.1 means 10%) in the debt objects (as seen in logs)
  // - but users might enter 2.5 meaning 2.5% (=> 0.025) in the UI, and that should already be converted upstream.
  // Therefore: treat the stored value as DECIMAL RATE (0.1 => 10%) and DO NOT divide by 100 here.
  const extractRateDecimal = (d: any): number => {
    const r =
      d?.annualInterestRate ??
      d?.interestRate ??
      d?.interestRatePct ??
      d?.rate ??
      d?.ratePct ??
      0;
    return n(r, 0); // 0.1 => 10%
  };

  const debtState: DebtState[] = (Array.isArray(debts) ? debts : []).map((d: any, idx: number) => ({
    id: String(d?.id ?? d?.ui_id ?? `debt_${idx}`),
    term: inferDebtTerm(d),
    principal: extractPrincipal(d),
    ratePct: extractRateDecimal(d), // actually decimal rate
  }));

  const recomputeDebtBucketsFromState = () => {
    debtBuckets.shortD = Math.trunc(
      debtState.filter((x) => x.term === "short").reduce((s, x) => s + n(x.principal), 0)
    );
    debtBuckets.longD = Math.trunc(
      debtState.filter((x) => x.term === "long").reduce((s, x) => s + n(x.principal), 0)
    );
  };

  if (debtState.length > 0) recomputeDebtBucketsFromState();

  const computeInterestFromState = (): number => {
    // interest based on principal at BEGINNING of year
    // ratePct is actually a DECIMAL RATE here (0.1 => 10%), matching your current debt objects
    let sum = 0;
    for (const ds of debtState) {
      const principal = Math.max(0, n(ds.principal));
      const r = n(ds.ratePct); // decimal rate
      sum += principal * r;
    }
    return Math.trunc(sum);
  };

  const applyAmortToState = (term: DebtTerm, amountCHF: number): number => {
    let remaining = Math.max(0, Math.trunc(amountCHF));
    if (remaining <= 0) return 0;

    // strategy: pay highest rate first (reduces future interest)
    const list = debtState
      .filter((d) => d.term === term && n(d.principal) > 0)
      .sort((a, b) => n(b.ratePct) - n(a.ratePct));

    let paid = 0;
    for (const d of list) {
      if (remaining <= 0) break;
      const avail = Math.max(0, Math.trunc(n(d.principal)));
      const pay = Math.min(avail, remaining);
      if (pay > 0) {
        d.principal = avail - pay;
        remaining -= pay;
        paid += pay;
      }
    }
    return paid;
  };

  // keep a "net worth" for compatibility with previous logic
  let wealth = Math.trunc(sumAssets(assets) - sumDebts(debtBuckets));

  const points: ForecastPoint[] = [];
  const breakdowns: YearBreakdown[] = [];
  const rows: ForecastRow[] = [];

  for (let t = 0; t <= horizonYears; t++) {
    const age = selfAgeTodayN + t;
    const year =
      n(baseYear, 0) > 0
        ? n(baseYear) + t
        : (input as any)?.meta?.startYear
          ? n((input as any).meta.startYear) + t
          : n((input as any).startYear, 0) > 0
            ? n((input as any).startYear) + t
            : 0;

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

    // amort plan etc. (schedule)
    const debtYear = applyDebtsDetailed({ debts });

    if (t === 0) {
      console.log("[FC] debts mapped", debts);
      console.log("[FC] debtYear plan", debtYear);
      console.log("[FC] debtState init", debtState);
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

    // --- interest based on remaining principal at START of year ---
    const interest = computeInterestFromState();

    // totalExpenses excludes amort (amort is balance-sheet transfer)
    const totalExpenses = expensesTotal + interest;

    // --- planned amort split (cap via state) ---
    const amortTotalPlanned = Math.max(0, n(debtYear.amort));
    const wantShort = Math.max(0, n(debtYear.amortShort));
    const wantLong = Math.max(0, n(debtYear.amortLong));

    // keep split within total
    const plannedShort = Math.min(wantShort, amortTotalPlanned);
    const plannedLong = Math.min(wantLong, Math.max(0, amortTotalPlanned - plannedShort));

    // apply amort to debtState (per term), capped by actual remaining principal
    const paidShort = applyAmortToState("short", plannedShort);
    const paidLong = applyAmortToState("long", plannedLong);
    const actualAmort = Math.trunc(paidShort + paidLong);

    // sync bucket totals from state (avoid drift)
    if (debtState.length > 0) recomputeDebtBucketsFromState();

    // totals (ohne interest)
    const expensesNoInterest = expensesTotal; // base+events (ohne interest)
    const incomeTotal = n(incomeBase + eventsIncome + assetCashflowToLiq);

    // 1) Income/Expenses (ohne interest) -> LIQ
    const netNoInterest = n(incomeTotal - expensesNoInterest);
    assets.liq = n(assets.liq) + netNoInterest;

    // falls LIQ < 0: decken (Rebalancing)
    const coverDraw = coverLiquidityDeficitTracked(assets);

    // 2) Zinsen zahlen (tracked)
    const interestDraw = payFromAssetsTracked(assets, interest);

    // 3) Tilgung zahlen (tracked) – debts wurden vorher reduziert
    const amortDraw = payFromAssetsTracked(assets, actualAmort);

    // net (wie bisher) fürs Reporting:
    const net = n(incomeTotal - (expensesNoInterest + interest));

    // ---- asset return (apply to invested/locked buckets) ----
    assets.shortA += n(assetCashflowReinvest.shortA);
    assets.longA += n(assetCashflowReinvest.longA);
    assets.realA += n(assetCashflowReinvest.realA);

    const investBeforeReturn = n(assets.shortA) + n(assets.longA) + n(assets.realA);

    assets.shortA = Math.trunc(n(assets.shortA) * (1 + g));
    assets.longA = Math.trunc(n(assets.longA) * (1 + g));
    assets.realA = Math.trunc(n(assets.realA) * (1 + g));

    const investAfterReturn = n(assets.shortA) + n(assets.longA) + n(assets.realA);
    const assetCF = investAfterReturn - investBeforeReturn;

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
      totalCHF: interest,
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
        expenses: expensesTotal, // base+events (without interest)
        debts: interest,
        debtsAmort: actualAmort,
        net,
        eventsIncome,
        eventsExpense,
        eventsNet,
        assetCF,
        assetCashflowToLiq,
        assetCashflowReinvest: assetCashflowReinvestTotal,
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

      debtInterest: interest,
      debtAmort: actualAmort,

      assetCashflowToLiq,
      assetCashflowReinvest: assetCashflowReinvestTotal,

      netFlow: net,
      assetCF,
      events: eventsNet,
      transferInterestFrom: {
        liq: interestDraw.liq,
        shortA: interestDraw.shortA,
        longA: interestDraw.longA,
        realA: interestDraw.realA,
      },
      transferAmortFrom: {
        liq: amortDraw.liq,
        shortA: amortDraw.shortA,
        longA: amortDraw.longA,
        realA: amortDraw.realA,
      },
      coverDeficitFrom: {
        shortA: coverDraw.shortA,
        longA: coverDraw.longA,
        realA: coverDraw.realA,
      },
    });
  }

  return { points, breakdowns, rows } as any;
}
