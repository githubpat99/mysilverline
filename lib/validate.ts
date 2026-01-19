import type { FormState, StepId } from "./types";

export function validateStep(step: StepId, form: FormState): boolean {
  switch (step) {
    case 1: {
      const d = form.step1;
      const ps = d.positions ?? [];

      return ps.every((p) => {
        const amountOk = Number.isFinite(p.amountChf) && p.amountChf >= 0;
        const cashflowOk = Number.isFinite(p.cashflowPa) && p.cashflowPa >= 0;

        const labelOk = typeof p.label === "string" && p.label.trim().length > 0;

        const availabilityOk =
          p.availability === "instant" ||
          p.availability === "3m_3y" ||
          p.availability === "gt_3y" ||
          p.availability === "locked";    // locked später entfernen

        const assetClassOk =
          p.assetClass === "cash" ||
          p.assetClass === "bank" ||
          p.assetClass === "securities" ||
          p.assetClass === "pension" ||
          p.assetClass === "real_estate" ||
          p.assetClass === "gold" ||
          p.assetClass === "crypto" ||
          p.assetClass === "p2p" ||
          p.assetClass === "other";

        const goalOk = p.goal === "liq" || p.goal === "reinvest";

        return amountOk && cashflowOk && labelOk && availabilityOk && assetClassOk && goalOk;
      });
    }

    case 2: {
      const d = form.step2;
      const ps = d.positions ?? [];

      return ps.every((p) => {
        const balanceOk = Number.isFinite(p.balanceChf) && p.balanceChf >= 0;

        const labelOk = typeof p.label === "string" && p.label.trim().length > 0;

        const availabilityOk =
          p.availability === "instant" ||
          p.availability === "3m_3y" ||
          p.availability === "gt_3y" ||
          p.availability === "locked";    // locked später entfernen

        const debtTypeOk =
          p.debtType === "mortgage" ||
          p.debtType === "loan" ||
          p.debtType === "consumer" ||
          p.debtType === "creditcard" ||
          p.debtType === "other";

        const rate = p.interestRatePct;
        const interestOk =
          rate === undefined || (Number.isFinite(rate) && rate >= 0 && rate <= 100);

        const currencyOk = p.currency === "CHF";

        return balanceOk && labelOk && availabilityOk && debtTypeOk && interestOk && currencyOk;
      });
    }

    case 3: {
      const d = form.step3;

      const eventsOk =
        !d.events ||
        d.events.every((e) => {
          const amountOk =
            Number.isFinite(e.line?.amount_chf) && (e.line.amount_chf ?? 0) >= 0;

          const startOk =
            typeof e.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.start_date);

          const endOk =
            e.end_date === null ||
            (typeof e.end_date === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(e.end_date) &&
              e.end_date >= e.start_date);

          const recurrenceOk =
            e.recurrence === "none" || e.recurrence === "yearly" || e.recurrence === "monthly";

          const lineTypeOk = e.line?.line_type === "income" || e.line?.line_type === "spending";

          return amountOk && startOk && endOk && recurrenceOk && lineTypeOk;
        });

      return (
        d.annualsV2 &&
        Array.isArray(d.annualsV2.income) &&
        Array.isArray(d.annualsV2.expense) &&
        eventsOk
      );
    }

    default:
      return false;
  }
}
