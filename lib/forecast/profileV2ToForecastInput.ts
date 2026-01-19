// src/lib/forecast/profileV2ToForecastInput.ts

import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { ForecastInput } from "@/lib/forecast/types";
import type { Money } from "@/lib/types/v2/money";
import type { Instrument } from "@/lib/types/v2/instruments";
import type { AnnualItem, Annuals } from "@/lib/types/v2/annuals";
import { clampInt } from "./financeMapping";

function moneyToCHF(m: Money | undefined | null): number {
    if (!m) return 0;
    if (typeof (m as any).chf === "number") return Math.trunc((m as any).chf);
    if (typeof m === "number") return Math.trunc(m);
    const n = Number((m as any).value ?? (m as any).amount ?? 0);
    return Math.trunc(isFinite(n) ? n : 0);
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

function normType(x: any): string {
    return String(x ?? "").toLowerCase().trim();
}

/**
 * Liquidität aus Instruments ableiten.
 * WICHTIG: Wenn nichts zuverlässig klassifiziert werden kann, NICHT "alle Assets" nehmen,
 * sonst werden langfristige Anlagen fälschlich als liquid behandelt.
 */
function mapLiquidityTodayCHF(instruments: Instrument[]): number {
    const assets = instruments.filter((i) => i.kind === "asset") as any[];

    const liquidTypes = new Set([
        "cash",
        "bargeld",
        "sight",
        "sichtguthaben",
        "bank",
        "banksavings",
        "banksaving",
        "saving",
        "sparen",
        "securities",
        "wertschriften",
        "etf",
        "stocks",
        "aktien",
        "funds",
        "fonds",
    ]);

    let liq = 0;
    let matched = 0;

    for (const a of assets) {
        const t =
            normType((a as any).assetType) ||
            normType((a as any).type) ||
            normType((a as any).category) ||
            normType((a as any).client_id) ||
            normType((a as any).label);

        const isLiquid = [...liquidTypes].some((k) => t.includes(k));
        if (isLiquid) {
            liq += moneyToCHF((a as any).value);
            matched++;
        }
    }

    // Konservativer Fallback: wenn nichts erkannt wird, lieber 0 + Warnung als falsch alles mitzuzählen.
    if (matched === 0) {
        console.warn(
            "[FC] mapLiquidityTodayCHF: no liquid assets matched (assetType/type/category/label). Returning 0 to avoid counting long-term assets as liquid.",
            {
                assets: assets.map((a) => ({
                    id: (a as any).id,
                    label: (a as any).label,
                    assetType: (a as any).assetType,
                    type: (a as any).type,
                    category: (a as any).category,
                    client_id: (a as any).client_id,
                    value: moneyToCHF((a as any).value),
                })),
            }
        );
        return 0;
    }

    return Math.trunc(liq);
}

function mapShortDebtTodayCHF(instruments: Instrument[]): number {
    const debts = instruments.filter((i) => i.kind === "debt") as any[];

    const shortTypes = new Set([
        "creditcard",
        "kreditkarte",
        "consumerloan",
        "konsumkredit",
        "othershort",
        "kurzfristig",
        "short",
    ]);

    let kfr = 0;
    let matched = 0;

    for (const d of debts) {
        const t =
            normType((d as any).debtType) ||
            normType((d as any).type) ||
            normType((d as any).category) ||
            normType((d as any).client_id) ||
            normType((d as any).label);

        const isShort = [...shortTypes].some((k) => t.includes(k));
        if (isShort) {
            kfr += moneyToCHF((d as any).balance);
            matched++;
        }
    }

    // Fallback: wenn nichts klassifiziert werden konnte → 0 (nicht alles als KFR behandeln)
    if (matched === 0) return 0;

    return Math.trunc(kfr);
}

function mapDebtsForForecast(instruments: Instrument[]): any[] {
    const debts = instruments.filter((i) => i.kind === "debt") as any[];

    return debts.map((d) => {
        const principalToday = moneyToCHF(d.balance);
        const raw = Number((d as any).interestRate ?? 0) || 0;
        const annualInterestRate = raw > 1 ? raw / 100 : raw;

        return {
            id: (d as any).id,
            label: (d as any).label,
            principalToday,
            annualInterestRate,
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
    /** nur freie Liquidität (Startwert für die Forecast-Kurve) */
    liquidityToday: number;
    /** kurzfristige Verbindlichkeiten (KFR) */
    shortDebtToday: number;
    /** frei verfügbar = liquidity - shortDebt (für UI-KPI "Ausgangslage") */
    availabilityToday: number;
    /** net worth (nur debug/ später, darf Forecast nicht starten) */
    wealthToday: number;
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
    const horizonRawAny =
        meta.forecastHorizonYears ??
        meta.forecast_horizon_years ??
        null;

    const horizonRawNum =
        typeof horizonRawAny === "number"
            ? horizonRawAny
            : Number(String(horizonRawAny ?? "").trim());

    const horizonYears = Number.isFinite(horizonRawNum) && horizonRawNum > 0 ? horizonRawNum : 55;

    // planToAge must be derived from horizon (NOT retireAtAge+30)
    const planToAge = selfAgeToday + horizonYears;
    const instruments = profile.instruments ?? [];
    
    // später: Vermögensverlauf typ-basiert
    const wealthToday = mapWealthTodayCHF(instruments);

    const debts = mapDebtsForForecast(instruments);



    // Ausgangslage (frei verfügbar)
    const liquidityToday = mapLiquidityTodayCHF(instruments);
    const shortDebtToday = mapShortDebtTodayCHF(instruments);
    const availabilityToday = Math.trunc(liquidityToday - shortDebtToday);

    /**
     * WICHTIGER FIX:
     * Der Forecast (Kurve + Tiefststand + "reicht") muss mit FREIER Liquidität starten,
     * nicht mit wealthToday (das enthält langfristige Anlagen).
     *
     * Deshalb: ForecastInput.wealthToday = availabilityToday (bis später der echte Vermögensverlauf kommt).
     */
    const input: ForecastInputWithStart = {
        baseYear,
        selfAgeToday,

        // Forecast-Startwert (aktuell missbraucht das Modell dieses Feld als "Start-Kapital" der Kurve)
        wealthToday: availabilityToday,

        retireAtAge,
        planToAge,

        

        spendingExtraGrowth: 0,
   
        oneOffSpendEvents: [],

   
        pensionsSelf: [],
        pensionsPartner: [],

        debts,
        events: profile.events ?? [],

        extraSafetyYears: 0,

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
