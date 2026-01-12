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

    // NEW
    baseYear,
    events = [],
  } = input as any;

  const horizonYears = Math.max(0, planToAge + extraSafetyYears - selfAgeToday);

  const points: ForecastPoint[] = [];
  const breakdowns: YearBreakdown[] = [];

  // --- HARD GUARD (sonst knallt es wie du gesehen hast) ---
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
    const year = baseYear + t;
    const wealthStart = wealth;

    // ---- Base Expenses (annual) ----
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

    // ---- Base Income (annual) ----
    const incomeBase = applyIncome({
      t,
      age,
      inflation,
      otherIncomes,
      pensionsSelf,
      pensionsPartner,
    });

    // ---- Debts ----
    const debtCostTotal = applyDebts({ debts });

    // ---- Events (YEAR-based, no partial years) ----
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

    // ---- Breakdown Lines ----
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

    // Test: Logge Breakdown Jahr 0
    if (t === 0) {
      console.log("[FC t0] incomeBase", incomeBase);
      console.log("[FC t0] expensesBase", expensesBase);
      console.log("[FC t0] debtCostTotal", debtCostTotal);
      console.log("[FC t0] eventIncome", eventsIncome);
      console.log("[FC t0] eventExpense", eventsExpense);
      console.log("[FC t0] eventsNet", eventsNet);
      console.log(
        "[FC t0] annualSpendingToday",
        annualSpendingToday,
        "spendingIndexation",
        spendingIndexation
      );
      console.log("[FC adapter] otherIncomes[0]", otherIncomes?.[0]);
    }

    // ---- Point (Chart) ----
    points.push({
      yearIndex: t,
      age,
      wealth: wealthStart,
      income: incomeTotal,
      expenses: totalExpenses,
    });

    // ---- Wealth Evolution ----
    const net = incomeTotal - totalExpenses;
    wealth = wealth + net;
    wealth = Math.trunc(wealth * (1 + g));
    const wealthEnd = wealth;

    // ---- Breakdown ----
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

        // NEW: Events separat (optional in Type, siehe types.ts)
        eventsIncome,
        eventsExpense,
        eventsNet,
      },
      // optional: wenn du Events im UI als Liste anzeigen willst
      events: {
        incomeLines: eventResult.incomeLines,
        expenseLines: eventResult.expenseLines,
      },
    });
  }

  return { points, breakdowns };
}
