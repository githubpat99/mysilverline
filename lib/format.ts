export function isNonNegativeMoney(input: string): boolean {
  return parseCHF(input) >= 0;
}

export function canonicalCHF(input: string): string {
  if (!input) return "";

  let v = input.trim();
  if (!v) return "";

  const neg = v.startsWith("-");
  if (neg) v = v.slice(1);

  // Tausender/Spaces raus
  v = v.replace(/[']/g, "").replace(/\s/g, "");

  // Dezimalteil hart wegschneiden (Punkt ODER Komma)
  const dot = v.indexOf(".");
  const comma = v.indexOf(",");
  const cut = [dot, comma].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (cut !== undefined) v = v.slice(0, cut);

  // nur Ziffern
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return "";

  return neg ? `-${digits}` : digits;
}

export function formatIntCH(n: number) {
  return n ? n.toLocaleString("de-CH") : "";
}

export function parseIntCH(raw: string) {
  const s = raw.replace(/['\s]/g, "").replace(/,/g, ".");
  const n = Math.trunc(Number(s));
  return Number.isFinite(n) ? n : 0;
}

export function parseCHF(input: string): number {
  if (!input) return 0;
  const raw = input.trim();
  const neg = raw.startsWith("-");
  const s = neg ? raw.slice(1) : raw;
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return neg ? -n : n;
}

export function formatCHF(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.trunc(n)).toString();
  const withSep = s.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return neg ? `-${withSep}` : withSep;
}

// Wenn du formatCHFInput behalten willst (ok):
export function formatCHFInput(input: string): string {
  if (!input) return "";
  const neg = input.trim().startsWith("-");
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return neg ? "-" : "";
  const out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return neg ? `-${out}` : out;
}

