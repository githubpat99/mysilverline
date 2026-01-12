import type { FormState, StepId } from "./types";
import { isNonNegativeMoney } from "./format";

export function validateStep(step: StepId, form: FormState): boolean {
  switch (step) {
    case 1: {
      const d = form.step1;
      const retireAge = Number(String(d.retireAtAge ?? "").trim());
      const retireOk = Number.isFinite(retireAge) && retireAge >= 50 && retireAge <= 75;

      return (
        isNonNegativeMoney(d.cash) &&
        isNonNegativeMoney(d.bankSavings) &&
        isNonNegativeMoney(d.securities) &&
        isNonNegativeMoney(d.otherInvest) &&
        retireOk
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

      const idxOk =
        d.indexation === "inflation" ||
        d.indexation === "fixed_nominal" ||
        d.indexation === "fixed_real";

      const eventsOk =
        !d.events ||
        d.events.every((e) => {
          const amountOk = Number.isFinite(e.line?.amount_chf) && (e.line.amount_chf ?? 0) >= 0;

          const startOk = typeof e.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.start_date);
          const endOk =
            e.end_date === null ||
            (typeof e.end_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.end_date) && e.end_date >= e.start_date);

          const recurrenceOk = e.recurrence === "none" || e.recurrence === "yearly" || e.recurrence === "monthly";
          const lineTypeOk = e.line?.line_type === "income" || e.line?.line_type === "spending";

          return amountOk && startOk && endOk && recurrenceOk && lineTypeOk;
        });

      return (
        isNonNegativeMoney(d.annualIncomeToday) &&
        isNonNegativeMoney(d.annualSpendingToday) &&
        idxOk &&
        eventsOk
      );
    }

    default:
      return false;
  }
}

function isValidBirthDateISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [yy, mm, dd] = s.split("-").map(Number);
  if (!yy || !mm || !dd) return false;

  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  // ensure date round-trips (catch 2025-02-31 etc.)
  const ok =
    dt.getUTCFullYear() === yy &&
    dt.getUTCMonth() === mm - 1 &&
    dt.getUTCDate() === dd;

  const nowY = new Date().getFullYear();
  return ok && yy >= 1900 && yy <= nowY;
}
