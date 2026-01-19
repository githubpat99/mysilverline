// src/lib/forecast/events/sumEventsForYearDetailed.ts
import type { ProfileEvent } from "@/lib/types/v2/events";
import type { BreakdownLine } from "@/lib/forecast/breakdown/types";

function yearOf(isoDate: string): number {
    return Number(isoDate.slice(0, 4));
}

function isActiveInYear(e: ProfileEvent, year: number): boolean {
    if (e.active !== 1) return false;

    const sy = yearOf(e.start_date);
    const ey = e.end_date ? yearOf(e.end_date) : null;

    if (e.recurrence === "none") return year === sy;

    if (year < sy) return false;
    if (ey !== null && year > ey) return false;
    return true;
}

function baseAnnualAmountCHF(e: ProfileEvent): number {
    const a = Math.trunc(e.line?.amount_chf ?? 0);
    // monthly => amount pro Monat -> pro Jahr = * 12
    if (e.recurrence === "monthly") return a * 12;
    // none/yearly => amount als Jahresbetrag (bzw. einmalig im Startjahr)
    return a;
}

function applyIndexationCHF(params: {
    baseCHF: number;
    indexation: "inflation" | "fixed_real" | "fixed_nominal" | null;
    inflation: number;
    yearsSinceStart: number;
}): number {
    const { baseCHF, indexation, inflation, yearsSinceStart } = params;

    if (!indexation || indexation === "fixed_nominal") return Math.trunc(baseCHF);

    // inflation oder fixed_real -> nominale Fortschreibung mit Inflation
    const y = Math.max(0, yearsSinceStart);
    const factor = Math.pow(1 + (inflation ?? 0), y);
    return Math.trunc(baseCHF * factor);
}

export function sumEventsForYearDetailed(params: {
    events: ProfileEvent[];
    baseYear: number; // Startjahr Forecast (z.B. new Date().getFullYear())
    yearIndex: number; // t
    inflation: number;
}): {
    incomeCHF: number;
    expenseCHF: number;
    incomeLines: BreakdownLine[];
    expenseLines: BreakdownLine[];
} {
    const { events, baseYear, yearIndex: t, inflation } = params;
    const year = baseYear + t;

    let incomeCHF = 0;
    let expenseCHF = 0;

    const incomeLines: BreakdownLine[] = [];
    const expenseLines: BreakdownLine[] = [];

    for (const e of events ?? []) {
        if (!isActiveInYear(e, year)) continue;

        const sy = yearOf(e.start_date);
        const yearsSinceStart = year - sy;

        const baseAnnual = baseAnnualAmountCHF(e);
        const idxAnnual = applyIndexationCHF({
            baseCHF: baseAnnual,
            indexation: e.line?.indexation ?? null,
            inflation,
            yearsSinceStart,
        });

        if (idxAnnual === 0) continue;

        const label = (e.title || "Ereignis").trim();

        const line: BreakdownLine = {
            label,
            amount: Math.trunc(idxAnnual), // <-- wichtig: amount, nicht amountCHF
        };

        if (e.line?.line_type === "income") {
            incomeCHF += line.amount;
            incomeLines.push(line);
        } else {
            expenseCHF += line.amount;
            expenseLines.push(line);
        }

    }

    return { incomeCHF, expenseCHF, incomeLines, expenseLines };
}
