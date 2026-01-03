// src/lib/date/age.ts
export function ageAtJan1OfYear(birthDateISO: string, year: number): number | null {
  // expected "YYYY-MM-DD"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateISO)) return null;

  const [y, m, d] = birthDateISO.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  // age on Jan 1: if birthday is after Jan 1, subtract 1. If birthday is Jan 1, no subtract.
  const afterJan1 = m > 1 || (m === 1 && d > 1);
  const age = year - y - (afterJan1 ? 1 : 0);

  if (age < 0 || age > 120) return null;
  return age;
}
