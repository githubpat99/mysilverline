// src/lib/forecast/profileV2ToForecastInput.ts

import type { ProfileV2 } from "@/lib/types/v2/profile";
import type { ForecastInput } from "@/lib/forecast/types";
import type { Money } from "@/lib/types/v2/money";
import type { Instrument } from "@/lib/types/v2/instruments";
import type { AnnualItem, Annuals } from "@/lib/types/v2/annuals";

function moneyToCHF(m: Money | undefined | null): number {
    if (!m) return 0;

    // Falls Money bei dir z.B. { chf: number } ist:
    if (typeof (m as any).chf === "number") return Math.trunc((m as any).chf);

    // Falls Money bei dir einfach number ist (manchmal legacy):
    if (typeof m === "number") return Math.trunc(m);

    // Fallback (damit es nicht crasht)
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
    const persons: any[] = hh.persons ?? [];
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

function mapWealthTodayCHF(instruments: Instrument[]): number {
    const assets = instruments.filter((i) => i.kind === "asset") as any[];
    const debts = instruments.filter((i) => i.kind === "debt") as any[];

    const assetsCHF = assets.reduce((sum, a) => sum + moneyToCHF(a.value), 0);
    const debtsCHF = debts.reduce((sum, d) => sum + moneyToCHF(d.balance), 0);

    return Math.trunc(assetsCHF - debtsCHF);
}

function mapDebtsForForecast(instruments: Instrument[]): any[] {
  const debts = instruments.filter((i) => i.kind === "debt") as any[];

  return debts.map((d) => {
    const principalToday = moneyToCHF(d.balance);

    // bei dir ist interestRate vermutlich in Prozent (z.B. 1.5) oder als Dezimal (0.015)
    const raw = Number(d.interestRate ?? 0) || 0;
    const annualInterestRate = raw > 1 ? raw / 100 : raw; // robust

    return {
      id: d.id,
      label: d.label,

      principalToday,
      annualInterestRate,

      payoffImmediately: false,

      // falls du später fixe Zahlungen willst:
      // annualPayment: undefined,
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

      // applyIncome erwartet genau diesen Namen:
      amountTodayOrAtStart: moneyToCHF(it.amount),

      // Offsets relativ zu baseYear:
      startYearOffset: Math.max(0, startYear - baseYear),
      endYearOffset: endYear === null ? undefined : Math.max(0, endYear - baseYear),

      // passt bei dir bereits:
      indexation: annuals.indexation ?? "inflation",

      // optional:
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
    // applyExpenses(...) nutzt spendingAdjustments; wir mappen Need-Items als jährliche Basispositionen.
    return (annuals.need ?? []).map((it) => ({
        id: it.id,
        label: it.label,
        amount: moneyToCHF(it.amount),
        startYear: Number(it.startYear ?? baseYear),
        endYear: it.endYear ? Number(it.endYear) : null,
        personId: it.personId ?? null,
        indexation: annuals.indexation,
    }));
}

export function profileV2ToForecastInput(
    profile: ProfileV2,
    overrides: Partial<ForecastInput> = {}
): ForecastInput {
    const baseYear = profile.meta?.startYear ?? new Date().getFullYear();

    const self = getSelfPerson(profile);
    const birthDate = String(self?.birthDate ?? "1980-01-01");
    const retireAtAge = Number(self?.retireAtAge ?? 65) || 65;

    console.log("[FC] baseYear:", baseYear);
    console.log("[FC] self:", { role: self?.role, id: self?.id, birthDate: self?.birthDate, retireAtAge: self?.retireAtAge });



    const selfAgeToday = calcAgeInYear(birthDate, baseYear);

    const instruments = profile.instruments ?? [];
    const annuals = profile.annuals;

    const wealthToday = mapWealthTodayCHF(instruments);
    const debts = mapDebtsForForecast(instruments);

    const annualSpendingToday = sumAnnualNeedBase(annuals, baseYear);

    // Achtung: ForecastInput erwartet spendingIndexation separat (legacy)
    // -> wir nehmen annuals.indexation (dein v2-Standard)
    const spendingIndexation = annuals.indexation ?? "inflation";

    const otherIncomes = mapAnnualsToOtherIncomes(annuals, baseYear);
    const spendingAdjustments = mapNeedToSpendingAdjustments(annuals, baseYear);

    const input: ForecastInput = {
        baseYear,
        selfAgeToday,
        wealthToday,
        retireAtAge,
        planToAge: retireAtAge + 30, // Standard: 30 Jahre nach Rente planen

        annualSpendingToday,
        spendingIndexation,

        spendingExtraGrowth: 0,
        spendingAdjustments,
        oneOffSpendEvents: [],

        otherIncomes,
        pensionsSelf: [],
        pensionsPartner: [],

        debts,

        events: profile.events ?? [],

        assumptions: {
            // fehlende Felder gemäss deinem TS-Fehler:
            currency: "CHF",
            taxMode: "none",

            // bestehende Felder:
            inflation: 0,
            returnMode: "nominal",
            nominalReturn: 0,
            annualFees: 0,
        } as any,

        extraSafetyYears: 0,

        ...(overrides ?? {}),
    };

    return input;
}
