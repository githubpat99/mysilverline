import type { IncomeLine, PensionDraft } from "@/lib/lotto/types";
import { applyIndexation } from "../utils/indexation";


export function applyIncome(params: {
    t: number;
    age: number;
    inflation: number;
    otherIncomes?: IncomeLine[];
    pensionsSelf?: PensionDraft[];
    pensionsPartner?: PensionDraft[];
}): number {
    const {
        t,
        age,
        inflation,
        otherIncomes = [],
        pensionsSelf = [],
        pensionsPartner = [],
    } = params;

    let income = 0;

    // other incomes are defined with year offsets; keep minimal & consistent:
    // - amountTodayOrAtStart grows depending on indexation
    for (const line of otherIncomes) {
        const start = line.startYearOffset ?? 0;
        const end = line.endYearOffset ?? Infinity;
        if (t < start || t > end) continue;

        let amt = line.amountTodayOrAtStart;
        const dt = t - start;

        amt = applyIndexation(amt, line.indexation, inflation, dt, line.extraGrowth ?? 0);

        income += amt;
    }

    // pensions (self + partner) based on startsAtAge
    const allPensions = [...pensionsSelf, ...pensionsPartner];
    for (const p of allPensions) {
        if (age < p.startsAtAge) continue;

        if (p.mode === "annuity") {
            income += p.annuityAnnual ?? 0;
        } else if (p.mode === "capital") {
            // capital is one-off at startsAtAge
            if (age === p.startsAtAge) income += p.capitalAmount ?? 0;
        }
    }

    return Math.trunc(income);
}
