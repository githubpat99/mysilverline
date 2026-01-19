import type { Debt, DebtYear } from "@/lib/forecast/types";
import { bucketFromAvailability, type Bucket } from "@/lib/forecast/buckets";

export function applyDebtsDetailed(params: { debts?: Debt[] }): DebtYear {
  const { debts = [] } = params;

  let interest = 0, amort = 0;
  let interestShort = 0, interestLong = 0;
  let amortShort = 0, amortLong = 0;

  for (const d of debts) {
    if ((d as any).payoffImmediately) continue;

    const principal = Math.trunc((d as any).principalToday ?? 0);
    const rate = (d as any).annualInterestRate ?? 0;

    const i = Math.trunc(principal * rate);
    interest += i;

    // amort only if annualPayment present
    let a = 0;
    if (typeof (d as any).annualPayment === "number") {
      a = Math.max(0, Math.trunc((d as any).annualPayment - i));
      amort += a;
    }

    // bucket split
    const av = (d as any).availability as any;
    const b: Bucket | null = av ? bucketFromAvailability(av) : null;
    const isShort = b === "LIQ" || b === "ST";

    if (isShort) {
      interestShort += i;
      amortShort += a;
    } else {
      interestLong += i;
      amortLong += a;
    }
  }

  return {
    interest: Math.trunc(interest),
    amort: Math.trunc(amort),
    interestShort: Math.trunc(interestShort),
    interestLong: Math.trunc(interestLong),
    amortShort: Math.trunc(amortShort),
    amortLong: Math.trunc(amortLong),
  };
}
