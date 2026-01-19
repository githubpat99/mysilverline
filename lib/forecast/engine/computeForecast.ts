// ================================
// file: src/lib/forecast/computeForecast.ts
// ================================

import { applyExpenses } from "../expenses/applyExpenses";
import { applyIncome } from "../income/applyIncome";
import { applyDebts } from "../debts/applyDebts";
import type { YearBreakdown } from "../breakdown/types";
import type { ForecastResult, ForecastInput, ForecastPoint } from "../types";
import { buildExpensesLines } from "../expenses/applyExpensesBreakdown";
import { buildIncomeLines } from "../income/applyIncomeBreakdown";
import { buildDebtLines } from "../debts/applyDebtsBreakdown";
import { sumEventsForYearDetailed } from "../events/sumEventsForYearDetailed";

export function computeForecast(input: ForecastInput): ForecastPoint[] {
  return computeForecastWithBreakdown(input).points;
}

export function computeForecastWithBreakdown(input: ForecastInput): ForecastResult {
  const {
    selfAgeToday,
    wealthToday,
    annualSpendingToday,
    spendingIndexation,
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
  } = input as any;

  const horizonYears = Math.max(0, planToAge + extraSafetyYears - selfAgeToday);

  const points: ForecastPoint[] = [];
  const breakdowns: YearBreakdown[] = [];

  const inflation = (assumptions?.inflation ?? 0) as number;

  const nominalReturn =
    assumptions?.returnMode === "nominal"
      ? (assumptions?.nominalReturn ?? 0)
      : (assumptions?.realReturn ?? 0) + inflation;

  const annualFees = assumptions?.annualFees ?? 0;
  const g = Math.max(-0.99, nominalReturn - annualFees);

  let wealth = Math.trunc(wealthToday);

  for (let t = 0; t <= horizonYears; t++) {
    const age = selfAgeToday + t;
    // baseYear wird hier nicht zwingend gebraucht, aber bleibt kompatibel
    // const year = (baseYear ?? 0) + t;

    const wealthStart = wealth;

    const expensesBase = applyExpenses({
      t,
      age,
      annualSpendingToday,
      spendingIndexation,
      inflation,
      spendingExtraGrowth,
      spendingAdjustments,
      oneOffSpendEvents,
    });

    const incomeBase = applyIncome({
      t,
      age,
      inflation,
      otherIncomes,
      pensionsSelf,
      pensionsPartner,
    });

    const debtCostTotal = applyDebts({ debts });

    const eventResult = sumEventsForYearDetailed({
      events,
      baseYear,
      yearIndex: t,
      inflation,
    });

    const eventsIncome = eventResult.incomeCHF;
    const eventsExpense = eventResult.expenseCHF;
    const eventsNet = eventsIncome - eventsExpense;

    const incomeTotal = incomeBase + eventsIncome;
    const expensesTotal = expensesBase + eventsExpense;
    const totalExpenses = expensesTotal + debtCostTotal;

    const incomeLines = [
      ...buildIncomeLines({
        t,
        age,
        inflation,
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
        annualSpendingToday,
        spendingIndexation,
        inflation,
        spendingExtraGrowth,
        spendingAdjustments,
        oneOffSpendEvents,
        totalCHF: expensesBase,
      }).lines,
      ...eventResult.expenseLines,
    ];

    const debtLines = buildDebtLines({
      debts,
      totalCHF: debtCostTotal,
    }).lines;

    points.push({
      yearIndex: t,
      age,
      wealth: wealthStart,
      income: incomeTotal,
      expenses: totalExpenses,
    });

    const net = incomeTotal - totalExpenses;
    wealth = wealth + net;
    wealth = Math.trunc(wealth * (1 + g));
    const wealthEnd = wealth;

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
        expenses: expensesTotal,
        debts: debtCostTotal,
        net,
        eventsIncome,
        eventsExpense,
        eventsNet,
      } as any,
      events: {
        incomeLines: eventResult.incomeLines,
        expenseLines: eventResult.expenseLines,
      },
    } as any);
  }

return { points, breakdowns };

}
