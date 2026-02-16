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
  eventsIncome: number;
  eventsExpense: number;
  annualsIncome: number;
  annualsExpense: number;

  // NEW: debt details
  debtInterest: number;
  debtAmort: number;

  // NEW
  assetCashflowToLiq: number;
  assetCashflowReinvest: number;
  assetCashflowReinvestBreakdown?: { shortA: number; longA: number; realA: number };

  // NEW: transfers (explicit, for UI)
  transferAmortFrom: { liq: number; shortA: number; longA: number; realA: number };
  // optional: falls du Rebalancing separat zeigen willst
  coverDeficitFrom: { shortA: number; longA: number; realA: number };
  transferInterestFrom: { liq: number; shortA: number; longA: number; realA: number };

  /** Phase 4: wenn Liquidität nicht reicht, Überzug erhöht */
  overdraftAdded?: number;

  /** Phase 5: pro Instrument (id → CHF) für UI-Labels */
  transferInterestFromByInstrument?: Record<string, number>;
  transferAmortFromByInstrument?: Record<string, number>;
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

type BucketKey = "liq" | "shortA" | "longA" | "realA";

/** instrumentId -> bucket (LIQ/ST/LT/REAL -> liq/shortA/longA/realA) */
function buildInstrumentToBucket(positions: any[]): Map<string, BucketKey> {
  const m = new Map<string, BucketKey>();
  const ps = Array.isArray(positions) ? positions : [];
  for (const p of ps) {
    const id = String(p?.id ?? p?.instrument_id ?? p?.ui_id ?? "");
    if (!id) continue;
    const av = String(p?.availability ?? p?.bucket ?? "").toLowerCase();
    const key: BucketKey =
      av === "instant" ? "liq"
      : av === "3m_3y" ? "shortA"
      : av === "gt_3y" ? "longA"
      : av === "locked" ? "realA"
      : av === "short" ? "shortA"
      : "liq";
    if (p.kind === "asset" || String(p?.kind ?? "").startsWith("asset")) {
      m.set(id, key);
    }
  }
  // defaults for system accounts
  if (!m.has("sys_liq_main")) m.set("sys_liq_main", "liq");
  if (!m.has("liquidity")) m.set("liquidity", "liq");
  return m;
}

type PayResult = { draw: AssetDraw; overdraftAdded: number };

/**
 * Pay amount from source bucket; if insufficient, add remainder to overdraft.
 * sourceInstrumentId maps to bucket (default liq). Overdraft increases shortD via debtState.
 */
function payFromSourceWithOverdraft(
  amountCHF: number,
  sourceInstrumentId: string | null | undefined,
  assets: AssetBuckets,
  instrumentToBucket: Map<string, BucketKey>,
  overdraftDebt: { id: string; principal: number } | null,
  debtState: { id: string; principal: number }[]
): PayResult {
  const drawRec = emptyDraw();
  let remaining = Math.max(0, Math.trunc(amountCHF));
  if (remaining <= 0) return { draw: drawRec, overdraftAdded: 0 };

  const defaultBucket: BucketKey = "liq";
  const sourceBucket =
    sourceInstrumentId && instrumentToBucket.has(sourceInstrumentId)
      ? instrumentToBucket.get(sourceInstrumentId)!
      : (sourceInstrumentId === "sys_liq_main" || sourceInstrumentId === "liquidity" ? "liq" : defaultBucket);

  // Zinsen/Tilgung: NUR aus LIQ und Kurzfristig. Wenn beide leer → Überzug.
  // Nie aus Langfristig oder Sachwerten (illiquide).
  const order: BucketKey[] =
    sourceBucket === "liq" ? ["liq", "shortA"]
    : sourceBucket === "shortA" ? ["shortA", "liq"]
    : sourceBucket === "longA" ? ["liq", "shortA"]
    : ["liq", "shortA"];

  for (const key of order) {
    if (remaining <= 0) break;
    const avail = Math.max(0, n(assets[key]));
    const take = Math.min(avail, remaining);
    if (take > 0) {
      assets[key] = avail - take;
      remaining -= take;
      (drawRec as any)[key] += take;
    }
  }

  let overdraftAdded = 0;
  if (remaining > 0 && overdraftDebt) {
    overdraftAdded = remaining;
    const idx = debtState.findIndex((d) => d.id === overdraftDebt.id);
    if (idx >= 0) debtState[idx].principal = n(debtState[idx].principal) + overdraftAdded;
  }

  return { draw: drawRec, overdraftAdded };
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
    principal: number;
    ratePct: number;
    interestSourceInstrumentId?: string;
    amortizationSourceInstrumentId?: string;
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

  const defaultLiqId = "sys_liq_main";
  const debtState: DebtState[] = (Array.isArray(debts) ? debts : []).map((d: any, idx: number) => ({
    id: String(d?.id ?? d?.ui_id ?? `debt_${idx}`),
    term: inferDebtTerm(d),
    principal: extractPrincipal(d),
    ratePct: extractRateDecimal(d),
    interestSourceInstrumentId: d?.interestSourceInstrumentId ?? d?.interest_source_instrument_id ?? defaultLiqId,
    amortizationSourceInstrumentId: d?.amortizationSourceInstrumentId ?? (d?.amortization as any)?.sourceInstrumentId ?? defaultLiqId,
  }));

  const positions = (input as any).positions ?? [];
  const instrumentToBucket = buildInstrumentToBucket(positions);
  const overdraftDebt = debtState.find((d) => String(d.id) === "sys_overdraft" || String(d.id) === "debt") ?? null;

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

  /** Returns total paid and per-debt breakdown for source-based payment */
  const applyAmortToStateWithBreakdown = (term: DebtTerm, amountCHF: number): { total: number; perDebt: { debtId: string; amount: number }[] } => {
    let remaining = Math.max(0, Math.trunc(amountCHF));
    const perDebt: { debtId: string; amount: number }[] = [];

    const list = debtState
      .filter((d) => d.term === term && n(d.principal) > 0)
      .sort((a, b) => n(b.ratePct) - n(a.ratePct));

    for (const d of list) {
      if (remaining <= 0) break;
      const avail = Math.max(0, Math.trunc(n(d.principal)));
      const pay = Math.min(avail, remaining);
      if (pay > 0) {
        d.principal = avail - pay;
        remaining -= pay;
        perDebt.push({ debtId: d.id, amount: pay });
      }
    }
    return { total: perDebt.reduce((s, x) => s + x.amount, 0), perDebt };
  };

  // keep a "net worth" for compatibility with previous logic
  let wealth = Math.trunc(sumAssets(assets) - sumDebts(debtBuckets));

  const points: ForecastPoint[] = [];
  const breakdowns: YearBreakdown[] = [];
  const rows: ForecastRow[] = [];

  for (let t = 0; t < horizonYears; t++) {
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

    // --- interest based on remaining principal at START of year (before amort reduces it) ---
    const interest = computeInterestFromState();
    const interestPerDebt = debtState.map((ds) => ({
      id: ds.id,
      amount: Math.trunc(Math.max(0, n(ds.principal)) * n(ds.ratePct)),
    }));

    // totalExpenses excludes amort (amort is balance-sheet transfer)
    const totalExpenses = expensesTotal + interest;

    // --- planned amort split (cap via state) ---
    const amortTotalPlanned = Math.max(0, n(debtYear.amort));
    const wantShort = Math.max(0, n(debtYear.amortShort));
    const wantLong = Math.max(0, n(debtYear.amortLong));

    const plannedShort = Math.min(wantShort, amortTotalPlanned);
    const plannedLong = Math.min(wantLong, Math.max(0, amortTotalPlanned - plannedShort));

    const amortShortResult = applyAmortToStateWithBreakdown("short", plannedShort);
    const amortLongResult = applyAmortToStateWithBreakdown("long", plannedLong);
    const actualAmort = Math.trunc(amortShortResult.total + amortLongResult.total);

    if (debtState.length > 0) recomputeDebtBucketsFromState();

    // totals (ohne interest) – für Reporting
    const expensesNoInterest = expensesTotal; // base+events (ohne interest)
    const incomeTotal = n(incomeBase + eventsIncome + assetCashflowToLiq);

    // === Reihenfolge: 1. Annuals, 2. Ereignisse, 3. Aktiven/Passiven (Zinsen, Amort) ===

    let coverDraw = emptyDraw();

    // 1) Annuals (Einnahmen/Ausgaben aus Jahresrechnung) -> LIQ
    const netAnnuals = n(incomeBase - expensesBase);
    assets.liq = n(assets.liq) + netAnnuals;
    const d1 = coverLiquidityDeficitTracked(assets);
    coverDraw.shortA += d1.shortA;
    coverDraw.longA += d1.longA;
    coverDraw.realA += d1.realA;

    // 2) Ereignisse -> LIQ
    const netEvents = n(eventsIncome - eventsExpense);
    assets.liq = n(assets.liq) + netEvents;
    const d2 = coverLiquidityDeficitTracked(assets);
    coverDraw.shortA += d2.shortA;
    coverDraw.longA += d2.longA;
    coverDraw.realA += d2.realA;

    // 3a) Asset-Cashflow zu Liquidität (aus Aktiven)
    assets.liq = n(assets.liq) + assetCashflowToLiq;
    const d3 = coverLiquidityDeficitTracked(assets);
    coverDraw.shortA += d3.shortA;
    coverDraw.longA += d3.longA;
    coverDraw.realA += d3.realA;

    // 3b) Zinsen zahlen – pro Schuld aus angegebener Quelle; Fehlbetrag → Überzug (Phase 4)
    // use interestPerDebt (principal at START of year), not mutated debtState
    let interestDraw = emptyDraw();
    let overdraftFromInterest = 0;
    const interestByInstrument: Record<string, number> = {};
    for (const { id, amount } of interestPerDebt) {
      const amt = amount;
      if (amt <= 0) continue;
      const ds = debtState.find((d) => d.id === id);
      if (!ds) continue;
      const src = ds.interestSourceInstrumentId ?? defaultLiqId;
      const res = payFromSourceWithOverdraft(amt, src, assets, instrumentToBucket, overdraftDebt, debtState);
      interestDraw.liq += res.draw.liq;
      interestDraw.shortA += res.draw.shortA;
      interestDraw.longA += res.draw.longA;
      interestDraw.realA += res.draw.realA;
      overdraftFromInterest += res.overdraftAdded;
      const paidFromAssets = amt - res.overdraftAdded;
      if (paidFromAssets > 0) {
        interestByInstrument[src] = (interestByInstrument[src] ?? 0) + paidFromAssets;
      }
    }

    // 3c) Amortisation zahlen – pro Schuld aus angegebener Quelle; Fehlbetrag → Überzug (Phase 4)
    let amortDraw = emptyDraw();
    let overdraftFromAmort = 0;
    const amortByInstrument: Record<string, number> = {};
    const amortItems = [...amortShortResult.perDebt, ...amortLongResult.perDebt];
    for (const { debtId, amount } of amortItems) {
      if (amount <= 0) continue;
      const ds = debtState.find((d) => d.id === debtId);
      const src = ds?.amortizationSourceInstrumentId ?? defaultLiqId;
      const res = payFromSourceWithOverdraft(amount, src, assets, instrumentToBucket, overdraftDebt, debtState);
      amortDraw.liq += res.draw.liq;
      amortDraw.shortA += res.draw.shortA;
      amortDraw.longA += res.draw.longA;
      amortDraw.realA += res.draw.realA;
      overdraftFromAmort += res.overdraftAdded;
      const paidFromAssets = amount - res.overdraftAdded;
      if (paidFromAssets > 0) {
        amortByInstrument[src] = (amortByInstrument[src] ?? 0) + paidFromAssets;
      }
    }

    const overdraftAdded = overdraftFromInterest + overdraftFromAmort;
    if (debtState.length > 0) recomputeDebtBucketsFromState();

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
      assetCashflowReinvestBreakdown: {
        shortA: n(assetCashflowReinvest.shortA),
        longA: n(assetCashflowReinvest.longA),
        realA: n(assetCashflowReinvest.realA),
      },

      netFlow: net,
      assetCF,
      events: eventsNet,
      eventsIncome,
      eventsExpense,
      annualsIncome: incomeBase,
      annualsExpense: expensesBase,
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
      overdraftAdded,
      transferInterestFromByInstrument: Object.keys(interestByInstrument).length > 0 ? interestByInstrument : undefined,
      transferAmortFromByInstrument: Object.keys(amortByInstrument).length > 0 ? amortByInstrument : undefined,
    });
  }

  return { points, breakdowns, rows } as any;
}
