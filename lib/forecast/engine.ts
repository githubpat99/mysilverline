// lib/forecast/engine.ts
import type { ProfileV2 } from "@/lib/types/v2";
import type { Instrument, AssetInstrument, DebtInstrument } from "@/lib/types/v2/instruments";
import type { EventFunding, FundingSource } from "@/lib/types/v2/events";
import type { ProfileEvent } from "@/lib/types/v2/events";
import type { ForecastResult, ForecastYearRow, Bucket, RunForecastOptions } from "./types";


function toInt(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}

function yearFromISO(date: string): number | null {
  // expects YYYY-MM-DD
  if (typeof date !== "string" || date.length < 4) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function bucketFromAsset(a: AssetInstrument): Bucket {
  // keep it simple + consistent
  const at = a.assetType;
  const avail = a.availability;

  if (at === "real_estate") return "real";
  if (avail === "instant") return "liquidity";
  if (avail === "3m_3y") return "short";
  if (avail === "gt_3y") return "long";
  if (avail === "locked") return "real"; // e.g. pension/locked things
  return "long";
}

function initialBalancesFromInstruments(instruments: Instrument[]): Record<Bucket, number> {
  const start: Record<Bucket, number> = {
    liquidity: 0,
    short: 0,
    long: 0,
    real: 0,
    debt: 0,
  };

  for (const ins of instruments) {
    if (!ins) continue;
    if (ins.kind === "asset") {
      const a = ins as AssetInstrument;
      const v = toInt((a.value as any)?.amount ?? a.value);
      start[bucketFromAsset(a)] += v;
    } else {
      const d = ins as DebtInstrument;
      const b = toInt((d.balance as any)?.amount ?? d.balance);
      start.debt += b;
    }
  }

  return start;
}

function sumAssetCashflowPa(instruments: Instrument[]): number {
  let s = 0;
  for (const ins of instruments) {
    if (ins?.kind !== "asset") continue;
    const a = ins as AssetInstrument;
    s += toInt((a as any).cashflow_pa ?? (a as any).cashflowPa ?? 0);
  }
  return s;
}

type AnnualItem = {
  id: string;
  label: string;
  amountCHF: number;
  startYear?: number;
  endYear?: number;
};

function isActiveInYear(item: AnnualItem, year: number): boolean {
  const s = item.startYear ?? year;
  const e = item.endYear ?? year;
  return year >= s && year <= e;
}

function sumAnnuals(list: any[], year: number): number {
  if (!Array.isArray(list)) return 0;
  let s = 0;
  for (const it of list) {
    const amt = toInt(it?.amountCHF ?? it?.amount_chf ?? it?.amount ?? 0);
    if (amt === 0) continue;
    const active = isActiveInYear(
      {
        id: String(it?.id ?? ""),
        label: String(it?.label ?? ""),
        amountCHF: amt,
        startYear: it?.startYear,
        endYear: it?.endYear,
      },
      year
    );
    if (active) s += amt;
  }
  return s;
}

function eventOccursInYear(e: ProfileEvent, year: number): boolean {
  if (!e || e.active !== 1) return false;

  const ys = yearFromISO(e.start_date);
  if (ys == null) return false;

  const ye = e.end_date ? yearFromISO(e.end_date) : null;

  if (year < ys) return false;
  if (ye != null && year > ye) return false;

  const rec = e.recurrence ?? "none";
  if (rec === "none") return year === ys;
  if (rec === "yearly") return year >= ys && (ye == null || year <= ye);
  if (rec === "monthly") return year >= ys && (ye == null || year <= ye); // v1: treat as yearly amount
  return false;
}

function pickFundingSources(funding?: EventFunding): FundingSource[] {
  if (!funding) return ["liquidity"];
  const strat = funding.fundingStrategy ?? "waterfall";
  const srcs = Array.isArray(funding.fundingSources) ? funding.fundingSources : [];

  if (strat === "fixedSplit") {
    // keep order as provided
    return srcs.map((x) => x.source).filter(Boolean) as FundingSource[];
  }
  // waterfall default
  const list = srcs.length ? srcs.map((x) => x.source) : ["liquidity", "short", "long"];
  return list.filter(Boolean) as FundingSource[];
}

function withdrawFromBuckets(
  end: Record<Bucket, number>,
  amount: number,
  funding?: EventFunding
): { ok: boolean; usedDebt: number } {
  let remaining = amount;
  let usedDebt = 0;

  const minLiq = toInt(funding?.minLiquidityCHF ?? 0);
  const allowLoan = !!funding?.allowLoanAsLastResort;

  const sources = pickFundingSources(funding);

  for (const src of sources) {
    if (remaining <= 0) break;

    if (src === "liquidity") {
      const available = Math.max(0, end.liquidity - minLiq);
      const take = Math.min(available, remaining);
      end.liquidity -= take;
      remaining -= take;
    } else if (src === "short") {
      const take = Math.min(end.short, remaining);
      end.short -= take;
      remaining -= take;
    } else if (src === "long") {
      const take = Math.min(end.long, remaining);
      end.long -= take;
      remaining -= take;
    } else if (src === "debt") {
      // explicit debt funding: borrow
      usedDebt += remaining;
      end.debt += remaining;
      remaining = 0;
    }
  }

  if (remaining > 0) {
    if (allowLoan) {
      usedDebt += remaining;
      end.debt += remaining;
      remaining = 0;
    } else {
      // not enough funds; clamp to what was possible (v1 behavior: stop at 0)
      // If you prefer: throw error or track deficit.
      return { ok: false, usedDebt };
    }
  }

  return { ok: true, usedDebt };
}

function applyDebtInterest(end: Record<Bucket, number>, instruments: Instrument[], dayCount: 360 | 365): number {
  // v1: interest = sum(balance * rate%)
  let interest = 0;
  for (const ins of instruments) {
    if (ins?.kind !== "debt") continue;
    const d = ins as DebtInstrument;
    const bal = toInt((d.balance as any)?.amount ?? d.balance);
    const rate = typeof d.interestRate === "number" && Number.isFinite(d.interestRate) ? d.interestRate : 0;
    interest += Math.trunc((bal * rate) / 100);
  }
  // interest is paid from liquidity (waterfall: liq -> short -> long -> loan if needed)
  if (interest > 0) {
    withdrawFromBuckets(end, interest, {
      fundingStrategy: "waterfall", fundingSources: [
        { source: "liquidity" }, { source: "short" }, { source: "long" }, { source: "debt" }
      ]
    });
  }
  return interest;
}

function applyDebtAmort(end: Record<Bucket, number>, instruments: Instrument[]): number {
  // v1: amortization reduces debt and consumes liquidity (waterfall)
  let amort = 0;

  for (const ins of instruments) {
    if (ins?.kind !== "debt") continue;
    const d = ins as DebtInstrument;
    const a = d.amortization;
    if (!a) continue;

    const amt = toInt((a.amountAnnual as any)?.amount ?? a.amountAnnual ?? 0);
    if (amt <= 0) continue;

    amort += amt;
  }

  if (amort > 0) {
    // pay from buckets
    const pay = withdrawFromBuckets(end, amort, {
      fundingStrategy: "waterfall", fundingSources: [
        { source: "liquidity" }, { source: "short" }, { source: "long" }, { source: "debt" }
      ]
    });

    // reduce debt only by actually paid amount (if no loan allowed, you could get ok:false)
    const paid = pay.ok ? amort : 0;
    end.debt = clampNonNeg(end.debt - paid);
  }

  return amort;
}

export function runForecast(profile: ProfileV2, opts: RunForecastOptions = {}): ForecastResult {
  const startYear = opts.startYear ?? profile.meta?.startYear ?? new Date().getFullYear();
  const horizonYears = opts.horizonYears ?? profile.meta?.forecastHorizonYears ?? 55;
  const dayCount = opts.interestDayCount ?? 360;

  const instruments = Array.isArray(profile.instruments) ? profile.instruments : [];
  const annuals = profile.annualsV2 ?? ({ income: [], expense: [] } as any);
  const events = Array.isArray(profile.events) ? profile.events : [];

  const start0 = initialBalancesFromInstruments(instruments);
  const assetCashflow = sumAssetCashflowPa(instruments);

  const rows: ForecastYearRow[] = [];

  let prevEnd = { ...start0 };

  for (let i = 0; i < horizonYears; i++) {
    const year = startYear + i;

    const start = { ...prevEnd };
    const end = { ...start };

    // annuals (income/expense)
    const incomeAnnual = sumAnnuals((annuals as any).income, year);
    const expenseAnnual = sumAnnuals((annuals as any).expense, year);

    // asset cashflow (constant per year in v1)
    const assetCashflowYear = assetCashflow;

    // apply incomes to liquidity
    end.liquidity += incomeAnnual + assetCashflowYear;

    // apply expenses (withdraw)
    if (expenseAnnual > 0) {
      withdrawFromBuckets(end, expenseAnnual, {
        fundingStrategy: "waterfall", fundingSources: [
          { source: "liquidity" }, { source: "short" }, { source: "long" }, { source: "debt" }
        ]
      });
    }

    // events
    let eventsIncome = 0;
    let eventsSpending = 0;
    const notes: string[] = [];

    for (const e of events as any as ProfileEvent[]) {
      if (!eventOccursInYear(e, year)) continue;
      const line = e.line;
      if (!line) continue;

      const amt = toInt(line.amount_chf ?? 0);
      if (amt === 0) continue;

      if (line.line_type === "income") {
        eventsIncome += amt;
        // v1: destination handling (if missing -> liquidity)
        const dest = line.destination ?? "liquidity";
        if (dest === "liquidity") end.liquidity += amt;
        else if (dest === "short") end.short += amt;
        else if (dest === "long") end.long += amt;
        else if (dest === "debt") end.debt = clampNonNeg(end.debt - amt);
      } else if (line.line_type === "spending") {
        eventsSpending += amt;
        const funding = line.funding;
        const res = withdrawFromBuckets(end, amt, funding ?? undefined);
        if (!res.ok) notes.push(`Event "${e.title}" (${year}): nicht voll finanzierbar (Rest blockiert).`);
      }
    }

    // debt interest + amort
    const debtInterest = applyDebtInterest(end, instruments, dayCount);
    const debtAmort = applyDebtAmort(end, instruments);

    const netWorthEnd = (end.liquidity + end.short + end.long + end.real) - end.debt;

    const row: ForecastYearRow = {
      year,
      start,
      incomeAnnual,
      expenseAnnual,
      eventsIncome,
      eventsSpending,
      assetCashflow: assetCashflowYear,
      debtInterest,
      debtAmort,
      end,
      netWorthEnd,
      notes: notes.length ? notes : undefined,
    };

    rows.push(row);
    prevEnd = end;
  }

  const points = rows.map((r, i) => ({
    yearIndex: i,
    age: 0,
    wealth: r.netWorthEnd,
    income: r.incomeAnnual + r.eventsIncome,
    expenses: r.expenseAnnual + r.eventsSpending,
  }));

  return { startYear, horizonYears, rows, points, breakdowns: [] };

}
