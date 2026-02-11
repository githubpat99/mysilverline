// src/lib/forecast/profileV2ToForecastInput.ts
//
// New situation (v2 transport):
// - ProfileV2 no longer carries instruments for transport.
// - Positions come from /positions endpoint (PositionDTO[]).
// - Annuals come from profile.annualsV2 (income/expense), with fallbacks.

import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { ForecastInput } from "@/lib/forecast/types";
import { clampInt } from "@/lib/forecast/financeMapping";
import {
    bucketFromAvailability,
    type Availability,
    type Bucket,
} from "@/lib/forecast/buckets";

// Adjust this import path to your real DTO type location.
// (You already used it elsewhere: "@/lib/types/v2/positions.dto")
import type { AssetDTO, DebtDTO } from "@/lib/types/v2/positions.dto";

// -----------------------------
// Helpers
// -----------------------------

function yearFromISODate(d: string): number {
    return Number(d?.slice(0, 4)) || 0;
}

function calcAgeInYear(birthDateISO: string, year: number): number {
    const by = yearFromISODate(birthDateISO);
    if (!by) return 0;
    return Math.max(0, year - by);
}

function getSelfPerson(profile: ProfileV2): any {
    const hh: any = profile.household as any;
    const persons: any[] = hh?.persons ?? [];
    return persons.find((p) => p.role === "self") ?? persons[0] ?? null;
}

function safeInt(n: unknown): number {
    const x = typeof n === "number" ? n : Number(String(n ?? "").trim());
    return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function safePctToRate(pct: unknown): number {
    // pct is expected as "0.6" or "2" meaning percent.
    const raw = typeof pct === "number" ? pct : Number(String(pct ?? "").trim());
    if (!Number.isFinite(raw)) return 0;
    return raw / 100;
}

function posAvailability(p: any): Availability | undefined {
    // In your DTO you store `bucket` (e.g. "instant", "3m_3y", "gt_3y", "locked")
    const b = String(p?.bucket ?? "").trim();
    if (b === "instant" || b === "3m_3y" || b === "gt_3y" || b === "locked") return b;
    // fallback: maybe old field `availability`
    const av = String(p?.availability ?? "").trim();
    if (av === "instant" || av === "3m_3y" || av === "gt_3y" || av === "locked") return av;
    return undefined;
}

function isItemActiveInYear(item: any, year: number): boolean {
    const s = Number(item.startYear ?? year);
    const e = item.endYear ? Number(item.endYear) : null;
    if (!s) return false;
    if (year < s) return false;
    if (e !== null && year > e) return false;
    return true;
}

// -----------------------------
// Debug / later use (net worth)
// -----------------------------
function mapNetWorthCHF(positions: Array<AssetDTO | DebtDTO>): number {
    const assets = positions.filter((p: any) => p.kind === "asset") as any[];
    const debts = positions.filter((p: any) => p.kind === "debt") as any[];

    const assetsCHF = assets.reduce((sum, a) => sum + safeInt(a.valueCHF ?? a.value_chf ?? 0), 0);
    // debt balance is also stored in valueCHF in your DTO mapping (see instrumentDebtToDto)
    const debtsCHF = debts.reduce((sum, d) => sum + safeInt(d.valueCHF ?? d.balanceCHF ?? d.balance_chf ?? 0), 0);

    return Math.trunc(assetsCHF - debtsCHF);
}

// -----------------------------
// Availability-based starts
// -----------------------------

function sumAssetsByAvailability(positions: Array<AssetDTO | DebtDTO>) {
    const assets = positions.filter((p: any) => p.kind === "asset") as any[];

    const out = { liq: 0, shortA: 0, longA: 0, realA: 0 };

    for (const a of assets) {
        const av = posAvailability(a);
        const v = safeInt(a.valueCHF ?? a.value_chf ?? 0);

        // If availability is missing, skip (prevents misclassifying long-term assets as liquid).
        if (!av) continue;

        const b: Bucket = bucketFromAvailability(av);
        switch (b) {
            case "LIQ":
                out.liq += v;
                break;
            case "ST":
                out.shortA += v;
                break;
            case "LT":
                out.longA += v;
                break;
            case "REAL":
                out.realA += v;
                break;
        }
    }

    return out;
}

function sumDebtsByAvailability(positions: Array<AssetDTO | DebtDTO>) {
    const debts = positions.filter((p: any) => p.kind === "debt") as any[];

    const out = { shortD: 0, longD: 0 };

    for (const d of debts) {
        const av = posAvailability(d);
        const v = safeInt(d.valueCHF ?? d.balanceCHF ?? d.balance_chf ?? 0);
        if (!av) continue;

        const b: Bucket = bucketFromAvailability(av);
        if (b === "LIQ" || b === "ST") out.shortD += v;
        else out.longD += v; // LT or REAL
    }

    return out;
}

// -----------------------------
// Asset cashflows (positions)
// -----------------------------
function sumAssetCashflows(positions: Array<AssetDTO | DebtDTO>) {
    const assets = positions.filter((p: any) => p.kind === "asset") as any[];

    let toLiq = 0;
    const reinvest = { shortA: 0, longA: 0, realA: 0 };

    for (const a of assets) {
        const av = posAvailability(a);
        const cf =
            safeInt(
                a.annualFlowCHF ??
                a.annual_flow_chf ??
                a.cashflow_pa ??
                a.cashflowPa ??
                a.cashflow ??
                a.cf ??
                0
            ) || 0;

        // goal / target naming in your earlier debugging: goal: "liq"
        const target = String(a.goal ?? a.cashflowTarget ?? a.target ?? "liq");

        if (!av || cf === 0) continue;

        const b: Bucket = bucketFromAvailability(av);

        if (target === "liq") {
            toLiq += cf;
        } else if (target === "reinvest") {
            if (b === "ST") reinvest.shortA += cf;
            else if (b === "LT") reinvest.longA += cf;
            else if (b === "REAL") reinvest.realA += cf;
        }
    }

    return { toLiq: Math.trunc(toLiq), reinvest };
}

// -----------------------------
// Debts for forecast (positions)
// -----------------------------
function mapDebtsForForecast(positions: Array<AssetDTO | DebtDTO>): any[] {
    const debts = positions.filter((p: any) => p.kind === "debt" || String(p?.kind ?? "").startsWith("debt")) as any[];

    const defaultLiqId = positions.some((p: any) => String(p?.id ?? p?.instrument_id) === "sys_liq_main")
        ? "sys_liq_main"
        : "liquidity";

    return debts.map((d) => {
        const principalToday = safeInt(d.valueCHF ?? d.balanceCHF ?? d.balance_chf ?? 0);

        // interestRatePct is in percent (0.6 / 0.7 / 2)
        const annualInterestRate = safePctToRate(d.interestRatePct ?? d.interestRate ?? 0);
        const interest = Math.trunc(principalToday * annualInterestRate);

        // amortization object (DTO uses amountAnnualCHF in your mapper)
        const amortObj = (d as any).amortization as
            | { type?: string; amountAnnualCHF?: number; amountAnnual?: number; sourceInstrumentId?: string }
            | null
            | undefined;

        const amortType = String(amortObj?.type ?? "none");
        const amortAnnual = Math.trunc(
            safeInt(amortObj?.amountAnnualCHF ?? amortObj?.amountAnnual ?? 0)
        );
        const amort = amortType === "direct" ? amortAnnual : 0;

        return {
            id: (d as any).id ?? (d as any).instrument_id ?? (d as any).ui_id,
            label: (d as any).label,
            principalToday,
            annualInterestRate,

            // enables amortization in applyDebtsDetailed()
            annualPayment: interest + amort,

            // keep availability for later logic (you use it elsewhere)
            availability: posAvailability(d),

            payoffImmediately: false,

            // source accounts for payments (Phase 4)
            interestSourceInstrumentId: (d as any).interestSourceInstrumentId ?? (d as any).interest_source_instrument_id ?? defaultLiqId,
            amortizationSourceInstrumentId: amortObj?.sourceInstrumentId ?? (amortObj as any)?.source_instrument_id ?? defaultLiqId,
        };
    });
}

// -----------------------------
// AnnualsV2 mapping (income/expense)
// -----------------------------
// Your profile uses `annualsV2` (income/expense). We map:
// - income -> otherIncomes
// - expense -> annualSpendingToday + spendingAdjustments
function mapAnnualsV2ToOtherIncomes(annualsV2: any, baseYear: number): any[] {
    const items: any[] = annualsV2?.income ?? [];
    return items.map((it) => {
        const startYear = Number(it.startYear ?? baseYear);
        const endYear = it.endYear ? Number(it.endYear) : null;

        return {
            id: it.id,
            label: it.label,
            amountTodayOrAtStart: safeInt(it.amountCHF ?? it.amount ?? it.valueCHF ?? 0),
            startYearOffset: Math.max(0, startYear - baseYear),
            endYearOffset: endYear === null ? undefined : Math.max(0, endYear - baseYear),
            indexation: annualsV2?.indexation ?? "inflation",
            extraGrowth: 0,
        };
    });
}

function sumAnnualSpendingBaseFromAnnualsV2(annualsV2: any, baseYear: number): number {
    const items: any[] = annualsV2?.expense ?? [];
    return items
        .filter((it) => isItemActiveInYear(it, baseYear))
        .reduce((sum, it) => sum + safeInt(it.amountCHF ?? it.amount ?? it.valueCHF ?? 0), 0);
}

function mapAnnualsV2ExpenseToSpendingAdjustments(annualsV2: any, baseYear: number): any[] {
    const items: any[] = annualsV2?.expense ?? [];
    return items.map((it) => ({
        id: it.id,
        label: it.label,
        amount: safeInt(it.amountCHF ?? it.amount ?? it.valueCHF ?? 0),
        startYear: Number(it.startYear ?? baseYear),
        endYear: it.endYear ? Number(it.endYear) : null,
        personId: it.personId ?? null,
        indexation: annualsV2?.indexation ?? "inflation",
    }));
}

// -----------------------------
// Return type
// -----------------------------
export type ForecastInputWithStart = ForecastInput & {
    /** nur freie Liquidität (Startwert für UI/KPIs) */
    liquidityToday: number;
    /** kurzfristige Verbindlichkeiten (KFR) */
    shortDebtToday: number;
    /** frei verfügbar = liquidity - shortDebt (für UI-KPI "Ausgangslage") */
    availabilityToday: number;

    /** net worth total (debug/ später) */
    wealthToday: number;

    annualSpendingToday: number;
    spendingIndexation: string;
    spendingAdjustments: any[];
    otherIncomes: any[];

    assetsToday: { liq: number; shortA: number; longA: number; realA: number };
    debtsToday: { shortD: number; longD: number };

    assetCashflowToLiq: number;
    assetCashflowReinvest: { shortA: number; longA: number; realA: number };

    // optional debug
    positionsCount?: number;

    /** Phase 4: positions for instrument-based payment sources */
    positions?: Array<AssetDTO | DebtDTO>;
};

// -----------------------------
// Main
// -----------------------------
export function profileV2ToForecastInput(
    profile: ProfileV2,
    params?: {
        positions?: Array<AssetDTO | DebtDTO>;
        overrides?: Partial<ForecastInput>;
    }
): ForecastInputWithStart {
    const overrides = params?.overrides ?? {};
    const positions = (params?.positions ?? []) as Array<AssetDTO | DebtDTO>;

    const baseYear = Number(profile.meta?.startYear) || new Date().getFullYear();

    const self = getSelfPerson(profile);
    const birthDate = String(self?.birthDate ?? "1980-01-01");
    const retireAtAge = Number(self?.retireAtAge ?? 65) || 65;
    const selfAgeToday = calcAgeInYear(birthDate, baseYear);

    // Horizon from profile.meta.forecastHorizonYears
    const meta: any = profile?.meta ?? {};
    const horizonRawAny = meta.forecastHorizonYears ?? meta.forecast_horizon_years ?? null;
    const horizonRawNum =
        typeof horizonRawAny === "number"
            ? horizonRawAny
            : Number(String(horizonRawAny ?? "").trim());
    const horizonYears = Number.isFinite(horizonRawNum) && horizonRawNum > 0 ? horizonRawNum : 55;

    // planToAge derived from horizon (NOT retireAtAge+30)
    const planToAge = selfAgeToday + horizonYears;

    // Debug-only net worth (assets - debts)
    const netWorthDebug = mapNetWorthCHF(positions);

    // Debts for forecast engine
    const debts = mapDebtsForForecast(positions);

    // Availability-based starts
    const assetsTodayAgg = sumAssetsByAvailability(positions);
    const debtsTodayAgg = sumDebtsByAvailability(positions);

    const liquidityToday = Math.trunc(assetsTodayAgg.liq);
    const shortDebtToday = Math.trunc(debtsTodayAgg.shortD);
    const availabilityToday = Math.trunc(liquidityToday - shortDebtToday);

    // AnnualsV2 (new)
    const annualsV2: any = (profile as any).annualsV2 ?? null;

    // Fallback (old) if needed
    const annualsOld: any = (profile as any).annuals ?? null;

    const otherIncomes = annualsV2
        ? mapAnnualsV2ToOtherIncomes(annualsV2, baseYear)
        : (annualsOld?.income ?? []).map((it: any) => ({
            id: it.id,
            label: it.label,
            amountTodayOrAtStart: safeInt(it.amountCHF ?? it.amount ?? 0),
            startYearOffset: Math.max(0, Number(it.startYear ?? baseYear) - baseYear),
            endYearOffset: it.endYear ? Math.max(0, Number(it.endYear) - baseYear) : undefined,
            indexation: annualsOld?.indexation ?? "inflation",
            extraGrowth: 0,
        }));

    const annualSpendingToday = annualsV2
        ? sumAnnualSpendingBaseFromAnnualsV2(annualsV2, baseYear)
        : (annualsOld?.need ?? [])
            .filter((it: any) => isItemActiveInYear(it, baseYear))
            .reduce((sum: number, it: any) => sum + safeInt(it.amountCHF ?? it.amount ?? 0), 0);

    const spendingAdjustments = annualsV2
        ? mapAnnualsV2ExpenseToSpendingAdjustments(annualsV2, baseYear)
        : (annualsOld?.need ?? []).map((it: any) => ({
            id: it.id,
            label: it.label,
            amount: safeInt(it.amountCHF ?? it.amount ?? 0),
            startYear: Number(it.startYear ?? baseYear),
            endYear: it.endYear ? Number(it.endYear) : null,
            personId: it.personId ?? null,
            indexation: annualsOld?.indexation ?? "inflation",
        }));

    const spendingIndexation =
        annualsV2?.indexation ??
        annualsOld?.indexation ??
        meta?.spendingIndexation ??
        "inflation";

    // Asset cashflows (from positions)
    const assetCF = sumAssetCashflows(positions);

    const input: ForecastInputWithStart = {
        baseYear,
        selfAgeToday,

        // keep legacy field but do NOT use for the liquidity curve.
        // If you want it meaningful: availabilityToday is your starting free liquidity.
        wealthToday: availabilityToday,

        retireAtAge,
        planToAge,

        spendingExtraGrowth: 0,
        oneOffSpendEvents: [],

        annualSpendingToday,
        spendingIndexation,
        spendingAdjustments,
        otherIncomes,

        pensionsSelf: [],
        pensionsPartner: [],

        debts,

        events: (profile as any).events ?? [],

        extraSafetyYears: 0,

        assetsToday: {
            liq: Math.trunc(assetsTodayAgg.liq),
            shortA: Math.trunc(assetsTodayAgg.shortA),
            longA: Math.trunc(assetsTodayAgg.longA),
            realA: Math.trunc(assetsTodayAgg.realA),
        },

        debtsToday: {
            shortD: Math.trunc(debtsTodayAgg.shortD),
            longD: Math.trunc(debtsTodayAgg.longD),
        },

        assetCashflowToLiq: assetCF.toLiq,
        assetCashflowReinvest: assetCF.reinvest, 

        liquidityToday,
        shortDebtToday,
        availabilityToday,

        positionsCount: positions.length,

        // Phase 4: positions for instrument-based payment sources
        positions,

        ...(overrides ?? {}),
    };

    // Keep debug net worth
    (input as any).wealthToday_networth_debug = netWorthDebug;

    // Safety clamps if you have them in your pipeline
    // Safety clamps
    input.baseYear = clampInt(input.baseYear, 1900, 2200, baseYear);
    input.selfAgeToday = clampInt(input.selfAgeToday, 0, 120, selfAgeToday);
    (input as any).planToAge = clampInt(
        (input as any).planToAge,
        0,
        140,
        planToAge
    );

    return input;
}
