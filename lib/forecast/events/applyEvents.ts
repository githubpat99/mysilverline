import type { Event } from "@/lib/types/v2/events";

function yearOf(isoDate: string): number {
  // isoDate = YYYY-MM-DD
  return Number(isoDate.slice(0, 4));
}

function isActiveInYear(e: Event, year: number): boolean {
  if (e.active !== 1) return false;

  const sy = yearOf(e.start_date);
  const ey = e.end_date ? yearOf(e.end_date) : null;

  if (e.recurrence === "none") return year === sy;

  // yearly/monthly: aktiv ab startYear bis endYear (falls gesetzt)
  if (year < sy) return false;
  if (ey !== null && year > ey) return false;
  return true;
}

function baseAnnualAmountCHF(e: Event): number {
  const a = Math.trunc(e.line?.amount_chf ?? 0);
  if (e.recurrence === "monthly") return a * 12;
  return a; // none oder yearly => a (pro Jahr bzw. einmal)
}

function indexedAmountCHF(baseCHF: number, indexation: string | null, inflation: number, yearsSinceStart: number): number {
  // Du willst “Jahresmodell”, daher nur exponentiell nach Jahren.
  // fixed_nominal: bleibt nominal konstant.
  // inflation / fixed_real: nominal wächst mit Inflation (real konstant).
  if (!indexation || indexation === "fixed_nominal") return baseCHF;

  const g = inflation ?? 0;
  const factor = Math.pow(1 + g, Math.max(0, yearsSinceStart));
  return Math.trunc(baseCHF * factor);
}

export function sumEventsForYear(params: {
  events: Event[];
  baseYear: number;     // z.B. aktuelles Kalenderjahr
  yearIndex: number;    // t
  inflation: number;
}): { incomeCHF: number; expenseCHF: number } {
  const { events, baseYear, yearIndex: t, inflation } = params;
  const year = baseYear + t;

  let inc = 0;
  let exp = 0;

  for (const e of events ?? []) {
    if (!isActiveInYear(e, year)) continue;

    const sy = yearOf(e.start_date);
    const yearsSinceStart = year - sy;

    const base = baseAnnualAmountCHF(e);
    const idx = indexedAmountCHF(base, e.line?.indexation ?? null, inflation, yearsSinceStart);

    if (e.line?.line_type === "income") inc += idx;
    else exp += idx; // "spending"
  }

  return { incomeCHF: inc, expenseCHF: exp };
}
