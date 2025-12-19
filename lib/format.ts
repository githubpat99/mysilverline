export function parseCHF(input: string): number {
  if (!input) return 0;

  // z.B. "10'000.50" / "10 000,50" / "10000"
  const cleaned = input
    .trim()
    .replace(/\s/g, "")
    .replace(/'/g, "")
    .replace(",", ".");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function isNonNegativeMoney(input: string): boolean {
  return parseCHF(input) >= 0;
}

export function formatCHFInput(input: string): string {
  if (!input) return "";

  // nur Ziffern, Apostroph, Punkt, Komma, Leerzeichen zulassen
  const cleaned = input
    .trim()
    .replace(/[']/g, "")
    .replace(/\s/g, "");

  // Dezimaltrennzeichen vereinheitlichen: Komma -> Punkt
  const normalized = cleaned.replace(",", ".");

  // minus nur vorne erlauben
  const neg = normalized.startsWith("-");
  const s = neg ? normalized.slice(1) : normalized;

  // split integer/decimal
  const [intRaw, decRaw] = s.split(".");
  const intDigits = (intRaw || "").replace(/[^\d]/g, "");
  const decDigits = (decRaw || "").replace(/[^\d]/g, "").slice(0, 2);

  // Tausendertrennzeichen mit Apostroph
  const intFormatted = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");

  const out = decDigits.length > 0 ? `${intFormatted}.${decDigits}` : intFormatted;
  return neg ? `-${out}` : out;
}
