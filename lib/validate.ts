import type { FormState, StepId } from "./types";
import { isNonNegativeMoney } from "./format";

export function validateStep(step: StepId, form: FormState): boolean {
  switch (step) {
    case 1: {
      const d = form.step1;
      return (
        isNonNegativeMoney(d.cash) &&
        isNonNegativeMoney(d.bankSavings) &&
        isNonNegativeMoney(d.securities) &&
        isNonNegativeMoney(d.otherInvest)
      );
    }
    case 2: {
      const d = form.step2;
      return (
        isNonNegativeMoney(d.creditCard) &&
        isNonNegativeMoney(d.consumerLoan) &&
        isNonNegativeMoney(d.otherShort) &&
        isNonNegativeMoney(d.mortgage) &&
        isNonNegativeMoney(d.loan) &&
        isNonNegativeMoney(d.otherLong)
      );
    }
    case 3: {
      const d = form.step3;
      return isNonNegativeMoney(d.futureIncome) && isNonNegativeMoney(d.futureExpense);
    }
    case 4: {
      const d = form.step4;
      const riskOk = d.risk !== null && d.risk >= 1 && d.risk <= 5;
      const horizonOk = d.horizonYears !== null && d.horizonYears >= 1 && d.horizonYears <= 40;
      return d.goal !== "" && riskOk && horizonOk;
    }
    case 5: {
      const d = form.step5;
      // bevorzugt und zu meiden sollten sich nicht überschneiden
      const overlap = d.preferred.some((x) => d.avoided.includes(x));
      return !overlap;
    }
    case 6: {
      const d = form.step6;
      return isNonNegativeMoney(d.minLiquidity) && isNonNegativeMoney(d.monthlySaving);
    }
    default:
      return false;
  }
}
