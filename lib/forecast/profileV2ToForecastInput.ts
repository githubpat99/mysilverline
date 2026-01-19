// src/lib/forecast/profileV2ToForecastInput.ts

import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { ForecastInput } from "@/lib/forecast/types";
import type { Money } from "@/lib/types/v2/money";
import type { Instrument } from "@/lib/types/v2/instruments";
import type { AnnualItem, Annuals } from "@/lib/types/v2/annuals";
import { clampInt } from "./financeMapping";
import {
    bucketFromAvailability,
    type Availability,
    type Bucket,
} from "@/lib/forecast/buckets";

function moneyToCHF(m: Money | undefined | null): number {
    if (!m) return 0;
    if (typeof (m as any).chf === "number") return Math.trunc((m as any).chf);
    if (typeof m === "number") return Math.trunc(m);
    const n = Number((m as any).value ?? (m as any).amount ?? 0);
    return Math.trunc(Number.isFinite(n) ? n : 0);
}

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

function isItemActiveInYear(item: AnnualItem, year: number): boolean {
    const s = Number(item.startYear ?? year);
    const e = item.endYear ? Number(item.endYear) : null;
    if (!s) return false;
    if (year < s) return false;
    if (e !== null && year > e) return false;
    return true;
}

/**
 * NOTE:
 * wealthToday (net worth) ist für später (Vermögensverlauf typ-basiert).
 * Für den "echten" Forecast (Liquiditätskurve) darf es NICHT verwendet werden.
 */
function mapWealthTodayCHF(instruments: Instrument[]): number {
    const assets = instruments.filter((i) => i.kind === "asset") as any[];
    const debts = instruments.filter((i) => i.kind === "debt") as any[];

    const assetsCHF = assets.reduce((sum, a) => sum + moneyToCHF(a.value), 0);
    const debtsCHF = debts.reduce((sum, d) => sum + moneyToCHF(d.balance), 0);

    return Math.trunc(assetsCHF - debtsCHF);
}

// ---------- NEW (availability-based starts) ----------

function sumAssetsByAvailability(instruments: Instrument[]) {
    const assets = instruments.filter((i) => i.kind === "asset") as any[];

    const out = { liq: 0, shortA: 0, longA: 0, realA: 0 };

    for (const a of assets) {
        const av = (a as any).availability as Availability | undefined;
        const v = moneyToCHF((a as any).value);

        // If availability is missing, we skip to avoid misclassifying long-term assets as liquid.
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

function sumAssetCashflows(instruments: Instrument[]) {
    const assets = instruments.filter((i) => i.kind === "asset") as any[];

    let toLiq = 0;
    const reinvest = { shortA: 0, longA: 0, realA: 0 };

    for (const a of assets) {
        const av = a.availability as Availability | undefined;
        const cf =
            Number(
                (a as any).cashflow_pa ??
                (a as any).cashflowPa ??
                (a as any).cashflow ??
                0
            ) || 0;

        const goal =
            String(
                (a as any).goal ??
                (a as any).cashflowTarget ??
                "liq"
            );

        const target = String(a.cashflowTarget ?? a.ziel ?? "liq"); // "liq" | "reinvest"

        if (!av || cf === 0) continue;

        const b: Bucket = bucketFromAvailability(av);

        if (target === "liq") {
            toLiq += cf;
        } else if (target === "reinvest") {
            if (b === "ST") reinvest.shortA += cf;
            else if (b === "LT") reinvest.longA += cf;
            else if (b === "REAL") reinvest.realA += cf;
            // b === "LIQ" -> ignorieren oder toLiq addieren, je nach UX-Entscheid
        }
    }

    return { toLiq: Math.trunc(toLiq), reinvest };
}

function sumDebtsByAvailability(instruments: Instrument[]) {
    const debts = instruments.filter((i) => i.kind === "debt") as any[];

    const out = { shortD: 0, longD: 0 };

    for (const d of debts) {
        const av = (d as any).availability as Availability | undefined;
        const v = moneyToCHF((d as any).balance);

        if (!av) continue;

        const b: Bucket = bucketFromAvailability(av);
        if (b === "LIQ" || b === "ST") out.shortD += v;
        else out.longD += v; // LT or REAL
    }

    return out;
}

// ---------- Forecast mapping helpers ----------

function mapDebtsForForecast(instruments: Instrument[]): any[] {
    const debts = instruments.filter((i) => i.kind === "debt") as any[];

    return debts.map((d) => {
        const principalToday = moneyToCHF(d.balance);

        // interestRate ist Prozent (0.6 / 0.7 / 2) -> Faktor
        const rawPct = Number(d.interestRatePct ?? d.interestRate ?? 0) || 0;
        const annualInterestRate = rawPct / 100;

        const interest = Math.trunc(principalToday * annualInterestRate);

        // NEW: amortization from instrument
        const amortObj = (d as any).amortization as { type?: string; amountAnnual?: number } | undefined;
        const amortType = String(amortObj?.type ?? "none");
        const amortAnnual = Math.trunc(Number(amortObj?.amountAnnual ?? 0) || 0);

        const amort = amortType === "direct" ? amortAnnual : 0;

        return {
            id: (d as any).id,
            label: (d as any).label,
            principalToday,
            annualInterestRate,

            // enables amortization in applyDebtsDetailed()
            annualPayment: interest + amort,
            availability: d.availability,   // << NEW
            payoffImmediately: false,
        };
    });
}


function mapAnnualsToOtherIncomes(annuals: Annuals, baseYear: number): any[] {
    return (annuals.income ?? []).map((it) => {
        const startYear = Number(it.startYear ?? baseYear);
        const endYear = it.endYear ? Number(it.endYear) : null;

        return {
            id: it.id,
            label: it.label,
            amountTodayOrAtStart: moneyToCHF(it.amount),
            startYearOffset: Math.max(0, startYear - baseYear),
            endYearOffset: endYear === null ? undefined : Math.max(0, endYear - baseYear),
            indexation: (annuals as any).indexation ?? "inflation",
            extraGrowth: 0,
        };
    });
}

function sumAnnualNeedBase(annuals: Annuals, baseYear: number): number {
    return (annuals.need ?? [])
        .filter((it) => isItemActiveInYear(it, baseYear))
        .reduce((sum, it) => sum + moneyToCHF(it.amount), 0);
}

function mapNeedToSpendingAdjustments(annuals: Annuals, baseYear: number): any[] {
    return (annuals.need ?? []).map((it) => ({
        id: it.id,
        label: it.label,
        amount: moneyToCHF(it.amount),
        startYear: Number(it.startYear ?? baseYear),
        endYear: it.endYear ? Number(it.endYear) : null,
        personId: it.personId ?? null,
        indexation: (annuals as any).indexation,
    }));
}

// Rückgabetyp inkl. Availability
export type ForecastInputWithStart = ForecastInput & {
    /** nur freie Liquidität (Startwert für UI/KPIs) */
    liquidityToday: number;
    /** kurzfristige Verbindlichkeiten (KFR) */
    shortDebtToday: number;
    /** frei verfügbar = liquidity - shortDebt (für UI-KPI "Ausgangslage") */
    availabilityToday: number;

    /** net worth total (für Debug/ später) */
    wealthToday: number;
    // Annuals -> Forecast (damit klar ist, dass das drin ist)
    annualSpendingToday: number;
    spendingIndexation: string; // oder IndexationMode, falls du es hast
    spendingAdjustments: any[]; // besser: SpendingAdjustment[]
    otherIncomes: any[];        // besser: OtherIncome[]

    /** Start-Buckets Aktiven */
    assetsToday: {
        liq: number;
        shortA: number;
        longA: number;
        realA: number;
    };

    /** Start-Buckets Passiven */
    debtsToday: {
        shortD: number;
        longD: number;
    };

    assetCashflowToLiq: number;
    assetCashflowReinvest: { shortA: number; longA: number; realA: number };

};

export function profileV2ToForecastInput(
    profile: ProfileV2,
    overrides: Partial<ForecastInput> = {}
): ForecastInputWithStart {
    const baseYear = profile.meta?.startYear ?? new Date().getFullYear();

    const self = getSelfPerson(profile);
    const birthDate = String(self?.birthDate ?? "1980-01-01");
    const retireAtAge = Number(self?.retireAtAge ?? 65) || 65;
    const selfAgeToday = calcAgeInYear(birthDate, baseYear);

    // ---- Horizon (years) from profile.meta.forecastHorizonYears
    const meta: any = profile?.meta ?? {};
    const horizonRawAny = meta.forecastHorizonYears ?? meta.forecast_horizon_years ?? null;

    const horizonRawNum =
        typeof horizonRawAny === "number" ? horizonRawAny : Number(String(horizonRawAny ?? "").trim());

    const horizonYears = Number.isFinite(horizonRawNum) && horizonRawNum > 0 ? horizonRawNum : 55;

    // planToAge must be derived from horizon (NOT retireAtAge+30)
    const planToAge = selfAgeToday + horizonYears;

    const instruments = profile.instruments ?? [];

    console.log("[FC] instruments debts RAW", instruments.filter((i: any) => i.kind === "debt"));



    // später: Vermögensverlauf typ-basiert (debug only)
    const wealthToday = mapWealthTodayCHF(instruments);

    const debts = mapDebtsForForecast(instruments);

    // NEW: availability-based starts
    const assetsTodayAgg = sumAssetsByAvailability(instruments);
    const debtsTodayAgg = sumDebtsByAvailability(instruments);

    // Ausgangslage (frei verfügbar)
    const liquidityToday = Math.trunc(assetsTodayAgg.liq);
    const shortDebtToday = Math.trunc(debtsTodayAgg.shortD);
    const availabilityToday = Math.trunc(liquidityToday - shortDebtToday);

    const annuals: Annuals = (profile as any).annuals ?? { income: [], need: [] };

    // Income: annuals.income -> otherIncomes (applyIncome)
    const otherIncomes = mapAnnualsToOtherIncomes(annuals, baseYear);

    // Need: im baseYear als "annualSpendingToday" (applyExpenses)
    const annualSpendingToday = sumAnnualNeedBase(annuals, baseYear);

    // Need über die Jahre als adjustments (applyExpenses)
    const spendingAdjustments = mapNeedToSpendingAdjustments(annuals, baseYear);

    // Indexation für Need/Spending (string/enum, nicht numeric)
    const spendingIndexation =
        (annuals as any).indexation ?? meta?.spendingIndexation ?? "inflation";

    // Asset Cashflows
    const assetCF = sumAssetCashflows(instruments);

    const input: ForecastInputWithStart = {
        baseYear,
        selfAgeToday,

        // Start-Nettovermögen (für Legacy/Debug)
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
        events: profile.events ?? [],

        extraSafetyYears: 0,

        // NEW: Bucket-Starts für Forecast (availability-basiert)
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

        // Extras für UI/KPIs
        liquidityToday,
        shortDebtToday,
        availabilityToday,

        ...(overrides ?? {}),
    };

    // Exponiere wealthToday (net worth) weiterhin für Debug/ später
    (input as any).wealthToday_networth_debug = wealthToday;

    return input;
}
