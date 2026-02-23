import { describe, it, expect } from "vitest";
import { computeForecastWithBreakdown } from "./computeForecast";

// ---- Helpers ----

const DEFAULT_POSITIONS = [
  { id: "sys_liq_main", kind: "asset", bucket: "instant" },
  { id: "pos_short", kind: "asset", bucket: "3m_3y" },
  { id: "pos_long", kind: "asset", bucket: "gt_3y" },
  { id: "pos_real", kind: "asset", bucket: "locked" },
] as const;

/** Erwarteter Zustand pro Jahr (nur angegebene Felder werden verglichen) */
export type ErwarteterZustand = Partial<{
  liq: number;
  shortA: number;
  longA: number;
  realA: number;
  shortD: number;
  longD: number;
  equity: number;
  debtInterest: number;
  debtAmort: number;
  transferInterestFrom: { liq?: number; shortA?: number };
  transferAmortFrom: { liq?: number; shortA?: number };
  overdraftAdded?: number;
}>;

/** Schuld gem. Sheet: Zinsen- und Tilgungs-Quelle explizit */
export type SchuldSheet = {
  id: string;
  principalToday: number;
  zinsSatz: number;
  annualPayment: number;
  availability: "3m_3y" | "gt_3y";
  zinsenQuelle: string;
  tilgungsQuelle: string;
};

/** Vollständige Ausgangslage gem. Sheet: Aktiven, Cashflow-Ziel, Passiven, erwartetes Resultat */
export type AusgangslageSheet = {
  name?: string;
  aktiven: { liq: number; shortA: number; longA?: number; realA?: number };
  cashflowReinvest: { shortA?: number; longA?: number; realA?: number };
  cashflowToLiq?: number;
  passiven: { shortD: number; longD?: number };
  schulden: SchuldSheet[];
  overdraft?: { zinsSatz: number }; // sys_overdraft mit Zinssatz
  horizonYears: number;
  erwartet: Partial<Record<1 | 2 | 3 | 5 | 10, ErwarteterZustand>>;
};

/** Baut Engine-Input aus AusgangslageSheet */
function inputFromSheet(sheet: AusgangslageSheet): any {
  const debts: any[] = sheet.schulden.map((s) => ({
    id: s.id,
    principalToday: s.principalToday,
    annualInterestRate: s.zinsSatz,
    annualPayment: s.annualPayment,
    availability: s.availability,
    interestSourceInstrumentId: s.zinsenQuelle,
    amortizationSourceInstrumentId: s.tilgungsQuelle,
  }));
  if (sheet.overdraft) {
    debts.push({
      id: "sys_overdraft",
      principalToday: 0,
      annualInterestRate: sheet.overdraft.zinsSatz,
      availability: "3m_3y",
      interestSourceInstrumentId: "sys_liq_main",
      amortizationSourceInstrumentId: "sys_liq_main",
    });
  }
  return makeInput({
    baseYear: 2026,
    planToAge: 40 + sheet.horizonYears,
    positions: DEFAULT_POSITIONS,
    assetsToday: {
      liq: sheet.aktiven.liq,
      shortA: sheet.aktiven.shortA,
      longA: sheet.aktiven.longA ?? 0,
      realA: sheet.aktiven.realA ?? 0,
    },
    debtsToday: { shortD: sheet.passiven.shortD, longD: sheet.passiven.longD ?? 0 },
    assetCashflowReinvest: {
      shortA: sheet.cashflowReinvest.shortA ?? 0,
      longA: sheet.cashflowReinvest.longA ?? 0,
      realA: sheet.cashflowReinvest.realA ?? 0,
    },
    assetCashflowToLiq: sheet.cashflowToLiq ?? 0,
    debts,
  });
}

/** Führt Forecast aus und vergleicht mit erwartet. Jahren (1, 2, 3, 5, 10) */
function runAndCompare(sheet: AusgangslageSheet) {
  const input = inputFromSheet(sheet);
  const r = computeForecastWithBreakdown(input);
  const rows = r.rows ?? [];
  expect(rows).toHaveLength(sheet.horizonYears);
  for (const [yearKey, expected] of Object.entries(sheet.erwartet)) {
    const year = +yearKey as 1 | 2 | 3 | 5 | 10;
    const row = rows[year - 1] as any;
    expect(row).toBeDefined();
    if (expected?.liq !== undefined) expect(row.liq).toBe(expected.liq);
    if (expected?.shortA !== undefined) expect(row.shortA).toBe(expected.shortA);
    if (expected?.longA !== undefined) expect(row.longA).toBe(expected.longA);
    if (expected?.realA !== undefined) expect(row.realA).toBe(expected.realA);
    if (expected?.shortD !== undefined) expect(row.shortD).toBe(expected.shortD);
    if (expected?.longD !== undefined) expect(row.longD).toBe(expected.longD);
    if (expected?.equity !== undefined) {
      const assets = (row.liq ?? 0) + (row.shortA ?? 0) + (row.longA ?? 0) + (row.realA ?? 0);
      const debts = (row.shortD ?? 0) + (row.longD ?? 0);
      expect(assets - debts).toBe(expected.equity);
    }
    if (expected?.debtInterest !== undefined) expect(row.debtInterest).toBe(expected.debtInterest);
    if (expected?.debtAmort !== undefined) expect(row.debtAmort).toBe(expected.debtAmort);
    if (expected?.transferInterestFrom?.liq !== undefined) expect(row.transferInterestFrom?.liq).toBe(expected.transferInterestFrom.liq);
    if (expected?.transferInterestFrom?.shortA !== undefined) expect(row.transferInterestFrom?.shortA).toBe(expected.transferInterestFrom.shortA);
    if (expected?.transferAmortFrom?.liq !== undefined) expect(row.transferAmortFrom?.liq).toBe(expected.transferAmortFrom.liq);
    if (expected?.transferAmortFrom?.shortA !== undefined) expect(row.transferAmortFrom?.shortA).toBe(expected.transferAmortFrom.shortA);
    if (expected?.overdraftAdded !== undefined) expect(row.overdraftAdded).toBe(expected.overdraftAdded);
  }
}

/** Ausgangslagen: wiederverwendbare Start-Konfigurationen für Testszenarien */
export const AUSGANGSLAGEN = {
  leer: {
    assetsToday: { liq: 0, shortA: 0, longA: 0, realA: 0 },
    debtsToday: { shortD: 0, longD: 0 },
    debts: [] as any[],
  },
  /** Sheet „Ausgangslage 1“: LIQ 500, Kurzfr. 5250, Schulden 1500, Reinvest 200 */
  ausgangslage1: {
    assetsToday: { liq: 500, shortA: 5250, longA: 0, realA: 0 },
    debtsToday: { shortD: 1500, longD: 0 },
    assetCashflowReinvest: { shortA: 200, longA: 0, realA: 0 },
    debts: [
      {
        id: "debt1",
        principalToday: 1500,
        annualInterestRate: 0.1,
        annualPayment: 1150,
        availability: "3m_3y",
        interestSourceInstrumentId: "sys_liq_main",
        amortizationSourceInstrumentId: "sys_liq_main",
      },
    ],
  },
  /** Überzug-Test: wenig Liquidität, Tilgung geht in Überzug */
  overdraft: {
    assetsToday: { liq: 0, shortA: 100, longA: 0, realA: 0 },
    debtsToday: { shortD: 500, longD: 0 },
    debts: [
      {
        id: "debt1",
        principalToday: 500, 
        annualInterestRate: 0,
        annualPayment: 500,
        availability: "3m_3y",
        interestSourceInstrumentId: "sys_liq_main",
        amortizationSourceInstrumentId: "sys_liq_main",
      },
      {
        id: "sys_overdraft",
        principalToday: 0,
        annualInterestRate: 0,
        availability: "3m_3y",
        interestSourceInstrumentId: "sys_liq_main",
        amortizationSourceInstrumentId: "sys_liq_main",
      },
    ],
  },
  /** Überzug mit 12% Zinsen: Tilgung → Überzug, Zinsen laufen ins Überzugskonto und werden mit 12% verzinst */
  overdraftMitZinsen: {
    assetsToday: { liq: 0, shortA: 100, longA: 0, realA: 0 },
    debtsToday: { shortD: 500, longD: 0 },
    debts: [
      {
        id: "debt1",
        principalToday: 500,
        annualInterestRate: 0,
        annualPayment: 500,
        availability: "3m_3y",
        interestSourceInstrumentId: "sys_liq_main",
        amortizationSourceInstrumentId: "sys_liq_main",
      },
      {
        id: "sys_overdraft",
        principalToday: 0,
        annualInterestRate: 0.12,
        availability: "3m_3y",
        interestSourceInstrumentId: "sys_liq_main",
        amortizationSourceInstrumentId: "sys_liq_main",
      },
    ],
  },
} as const;

/** Sheet-basierte Ausgangslagen: vollständige Definition mit erwartetem Resultat */
export const SHEET_AUSGANGSLAGEN: Record<string, AusgangslageSheet> = {
  ausgangslage1: {
    name: "Ausgangslage 1",
    aktiven: { liq: 500, shortA: 5250, longA: 0, realA: 0 },
    cashflowReinvest: { shortA: 200, longA: 0, realA: 0 },
    passiven: { shortD: 1500, longD: 0 },
    schulden: [
      {
        id: "debt1",
        principalToday: 1500,
        zinsSatz: 0.1,
        annualPayment: 150 + 1000,
        availability: "3m_3y",
        zinsenQuelle: "sys_liq_main",
        tilgungsQuelle: "sys_liq_main",
      },
    ],
    horizonYears: 1,
    erwartet: {
      1: { liq: 0, shortA: 4800, shortD: 500, equity: 4300, debtInterest: 150, debtAmort: 1000, transferInterestFrom: { liq: 150, shortA: 0 }, transferAmortFrom: { liq: 350, shortA: 650 } },
    },
  },
  ausgangslage1_5jahre: {
    name: "Ausgangslage 1 – 5 Jahre",
    aktiven: { liq: 500, shortA: 5250, longA: 0, realA: 0 },
    cashflowReinvest: { shortA: 200, longA: 0, realA: 0 },
    passiven: { shortD: 1500, longD: 0 },
    schulden: [
      {
        id: "debt1",
        principalToday: 1500,
        zinsSatz: 0.1,
        annualPayment: 150 + 1000,
        availability: "3m_3y",
        zinsenQuelle: "sys_liq_main",
        tilgungsQuelle: "sys_liq_main",
      },
    ],
    horizonYears: 5,
    erwartet: {
      1: { shortD: 500, equity: 4300 },
      2: { shortD: 0, equity: 4450 },
      3: { shortA: 4650, equity: 4650 },
      5: { liq: 0, shortD: 0, equity: 5050 },
    },
  },
  /** Ausgangslage 2 (Sheet): kurzfristige + langfristige Schulden, Cashflow to Liq, Reinvest in Kurzfr. */
  ausgangslage2: {
    name: "Ausgangslage 2",
    aktiven: { liq: 500, shortA: 9_500, longA: 60_000, realA: 2_400_000 },
    cashflowReinvest: { shortA: 500 },
    cashflowToLiq: 20_000,
    passiven: { shortD: 5_000, longD: 1_245_000 },
    schulden: [
      {
        id: "short1",
        principalToday: 5_000,
        zinsSatz: 0,
        annualPayment: 5_000,
        availability: "3m_3y",
        zinsenQuelle: "sys_liq_main",
        tilgungsQuelle: "sys_liq_main",
      },
      {
        id: "long1",
        principalToday: 1_245_000,
        zinsSatz: 0.007,
        annualPayment: 8_715 + 5_600,
        availability: "gt_3y",
        zinsenQuelle: "sys_liq_main",
        tilgungsQuelle: "sys_liq_main",
      },
    ],
    horizonYears: 1,
    erwartet: {
      1: {
        liq: 1_185,
        shortA: 10_000,
        longA: 60_000,
        realA: 2_400_000,
        shortD: 0,
        longD: 1_239_400,
        equity: 1_231_785,
        debtInterest: 8_715,
        debtAmort: 10_600,
        transferInterestFrom: { liq: 8_715, shortA: 0 },
        transferAmortFrom: { liq: 10_600, shortA: 0 },
      },
    },
  },
  overdraftMitZinsenSheet: {
    name: "Überzug mit 12% Zinsen",
    aktiven: { liq: 0, shortA: 100, longA: 0, realA: 0 },
    cashflowReinvest: {},
    passiven: { shortD: 500, longD: 0 },
    schulden: [
      { id: "debt1", principalToday: 500, zinsSatz: 0, annualPayment: 500, availability: "3m_3y", zinsenQuelle: "sys_liq_main", tilgungsQuelle: "sys_liq_main" },
    ],
    overdraft: { zinsSatz: 0.12 },
    horizonYears: 2,
    erwartet: {
      1: { shortD: 400, overdraftAdded: 400 },
      2: { shortD: 448, debtInterest: 48 },
    },
  },
} as const;

/** Baut Engine-Input aus einer Ausgangslage + optionalen Overrides */
function makeScenario(
  ausgangslage: keyof typeof AUSGANGSLAGEN,
  overrides: Record<string, unknown> = {}
) {
  const base = AUSGANGSLAGEN[ausgangslage] as Record<string, unknown>;
  const o = overrides as Record<string, unknown>;
  return makeInput({
    ...base,
    ...o,
    baseYear: 2026,
    positions: DEFAULT_POSITIONS,
    assetsToday: { ...(base.assetsToday as object), ...((o.assetsToday as object) ?? {}) },
    debtsToday: { ...(base.debtsToday as object), ...((o.debtsToday as object) ?? {}) },
    debts: o.debts !== undefined ? o.debts : base.debts, 
    planToAge: o.planToAge ?? 41,
    assetCashflowReinvest: o.assetCashflowReinvest ?? base.assetCashflowReinvest ?? { shortA: 0, longA: 0, realA: 0 },
  });
}

/** Minimal-Input für Engine (ohne Profile) */
function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    baseYear: 2026,
    selfAgeToday: 40,
    wealthToday: 0,
    annualSpendingToday: 0,
    spendingIndexation: "inflation",
    spendingAdjustments: [],
    oneOffSpendEvents: [],
    otherIncomes: [],
    pensionsSelf: [],
    pensionsPartner: [],
    debts: [],
    assumptions: { inflation: 0.02, returnMode: "nominal", nominalReturn: 0, annualFees: 0 },
    planToAge: 41,
    extraSafetyYears: 0,
    retireAtAge: 65,
    events: [],
    assetCashflowToLiq: 0,
    assetCashflowReinvest: { shortA: 0, longA: 0, realA: 0 },
    assetsToday: { liq: 0, shortA: 0, longA: 0, realA: 0 },
    debtsToday: { shortD: 0, longD: 0 },
    ...overrides,
  } as any;
}

/** Prüft Bilanz-Invarianten für alle Zeilen */
function assertInvariants(rows: any[]) {
  if (!rows?.length) return;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const assetsEnd = (r.liq ?? 0) + (r.shortA ?? 0) + (r.longA ?? 0) + (r.realA ?? 0);
    const debtsEnd = (r.shortD ?? 0) + (r.longD ?? 0);
    const equity = assetsEnd - debtsEnd;
    expect(equity).toBeGreaterThanOrEqual(-1e9); // erlaubt Überzug
    expect(Number.isFinite(assetsEnd) && Number.isFinite(debtsEnd)).toBe(true);
  }
  // Kontinuität: row[t].start === row[t-1] end
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    expect(curr.start?.liq).toBe(prev.liq);
    expect(curr.start?.shortA).toBe(prev.shortA);
    expect(curr.start?.longA).toBe(prev.longA);
    expect(curr.start?.realA).toBe(prev.realA);
    expect(curr.start?.shortD).toBe(prev.shortD);
    expect(curr.start?.longD).toBe(prev.longD);
  }
}

/** Schulden-Szenario aus Parametern */
function makeDebtScenario(config: {
  horizonYears: number;
  assetsToday: { liq: number; shortA: number; longA?: number; realA?: number };
  debtsToday: { shortD: number; longD?: number };
  debt: { principal: number; rate: number; annualPayment: number; interestSource?: string; amortSource?: string };
  assetCashflowReinvest?: { shortA?: number; longA?: number; realA?: number };
}) {
  const { horizonYears, assetsToday, debtsToday, debt, assetCashflowReinvest = {} } = config;
  return makeInput({
    baseYear: 2026,
    planToAge: 40 + horizonYears,
    assetsToday: {
      liq: assetsToday.liq,
      shortA: assetsToday.shortA,
      longA: assetsToday.longA ?? 0,
      realA: assetsToday.realA ?? 0,
    },
    debtsToday: { shortD: debtsToday.shortD, longD: debtsToday.longD ?? 0 },
    assetCashflowReinvest: {
      shortA: assetCashflowReinvest.shortA ?? 0,
      longA: assetCashflowReinvest.longA ?? 0,
      realA: assetCashflowReinvest.realA ?? 0,
    },
    debts: [
      {
        id: "debt1",
        principalToday: debt.principal,
        annualInterestRate: debt.rate,
        annualPayment: debt.annualPayment,
        availability: "3m_3y",
        interestSourceInstrumentId: debt.interestSource ?? "sys_liq_main",
        amortizationSourceInstrumentId: debt.amortSource ?? "sys_liq_main",
      },
    ],
    positions: [
      { id: "sys_liq_main", kind: "asset", bucket: "instant" },
      { id: "pos_short", kind: "asset", bucket: "3m_3y" },
    ],
  });
}

describe("computeForecast engine", () => {
  it("produces exactly horizonYears data points when horizon is 4", () => {
    const baseYear = 2026;
    const result = computeForecastWithBreakdown(
      makeInput({ planToAge: 44, baseYear })
    );

    expect(result.rows).toHaveLength(4);
    expect(result.rows?.[0]?.year).toBe(baseYear);
    expect(result.rows?.[3]?.year).toBe(baseYear + 3);
  });

  it("produces exactly horizonYears data points when horizon is 5", () => {
    const result = computeForecastWithBreakdown(makeInput({ planToAge: 45 }));

    expect(result.rows).toHaveLength(5);
  });
});

describe("Invarianten", () => {
  it.each([
    ["leer", makeInput({ planToAge: 41 })],
    ["Ausgangslage 1", makeScenario("ausgangslage1")],
    ["5 Jahre", makeInput({ planToAge: 45 })],
    ["Überzug mit Zinsen", makeScenario("overdraftMitZinsen", { planToAge: 42 })],
  ])("Bilanz und Kontinuität halten für %s", (_label, input) => {
    const r = computeForecastWithBreakdown(input as any);
    assertInvariants(r.rows ?? []);
  });
});

describe("Layer 1: Zinsen", () => {
  it("Zinsen werden auf Principal vor Tilgung berechnet (10% auf 1500 = 150)", () => {
    const input = makeDebtScenario({
      horizonYears: 1,
      assetsToday: { liq: 500, shortA: 6000 },
      debtsToday: { shortD: 1500 },
      debt: { principal: 1500, rate: 0.1, annualPayment: 150 }, // nur Zinsen, keine Tilgung
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.debtInterest).toBe(150);
    expect(row?.debtAmort).toBe(0);
  });

  it("Zinsen-Quelle LIQ: transferInterestFrom.liq = Zinsbetrag", () => {
    const input = makeDebtScenario({
      horizonYears: 1,
      assetsToday: { liq: 500, shortA: 6000 },
      debtsToday: { shortD: 1500 },
      debt: { principal: 1500, rate: 0.1, annualPayment: 150, interestSource: "sys_liq_main" },
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.transferInterestFrom?.liq).toBe(150);
    expect(row?.transferInterestFrom?.shortA).toBe(0);
  });
});

describe("Layer 1: Tilgung", () => {
  it("Tilgung nur aus LIQ und Kurzfr. (nicht longA/realA)", () => {
    const input = makeDebtScenario({
      horizonYears: 1,
      assetsToday: { liq: 100, shortA: 1000, longA: 5000 },
      debtsToday: { shortD: 1500 },
      debt: { principal: 1500, rate: 0, annualPayment: 500, amortSource: "pos_short" },
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.transferAmortFrom?.shortA).toBeGreaterThan(0);
    expect(row?.transferAmortFrom?.longA).toBe(0);
    expect(row?.transferAmortFrom?.realA).toBe(0);
  });
});

describe("Layer 1: Cashflow", () => {
  it("assetCashflowReinvestBreakdown landet in shortA", () => {
    const input = makeInput({
      planToAge: 42,
      assetsToday: { liq: 0, shortA: 1000, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      assetCashflowReinvest: { shortA: 300, longA: 0, realA: 0 },
      positions: [{ id: "pos_short", kind: "asset", bucket: "3m_3y" }],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.assetCashflowReinvestBreakdown?.shortA).toBe(300);
    expect(row?.shortA).toBe(1300); // 1000 + 300
  });
});

describe("Randfälle", () => {
  it("Überzug wenn LIQ+shortA für Tilgung nicht reicht", () => {
    const input = makeScenario("overdraft");
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.overdraftAdded).toBeGreaterThan(0); // 400: brauchen 500, haben 100
  });

  it("Überzug: Zinsen laufen ins Überzugskonto und werden mit 12% verzinst", () => {
    const input = makeScenario("overdraftMitZinsen", { planToAge: 42 }); // 2 Jahre
    const r = computeForecastWithBreakdown(input);
    const row1 = r.rows?.[0] as any;
    expect(row1?.overdraftAdded).toBe(400);
    expect(row1?.shortD).toBe(400);
    const row2 = r.rows?.[1] as any;
    expect(row2?.debtInterest).toBe(48);
    expect(row2?.shortD).toBe(448);
  });
});

describe("Ausgangslagen Sheet – Compare", () => {
  it.each(Object.entries(SHEET_AUSGANGSLAGEN))("%s: Resultat entspricht erwartet", (_key, sheet) => {
    runAndCompare(sheet);
  });
});

/**
 * Ausgangslage 1 (Sheet): Start 2026 → Ende 2026
 * - Aktiven Start: 5750 (LIQ 500, Kurzfr. 5250)
 * - Passiven Start: 1500 (Kurzfr. 1500)
 * - Zinsen 10% auf 1500 = 150 (Quelle: LIQ 150)
 * - Tilgung 1000 (Quelle: LIQ 350, Kurzfr. 650)
 * - Cashflow Reinvest: 200 (→ Kurzfr.)
 *
 * Erwartet Ende:
 * - LIQ: 0, Kurzfr.: 4800
 * - Passiven: 500
 * - Eigenkapital: 4300
 */
describe("Ausgangslage 1 – Resultatvergleich", () => {
  const input = makeInput({
    baseYear: 2026,
    planToAge: 41,
    assetsToday: { liq: 500, shortA: 5250, longA: 0, realA: 0 },
    debtsToday: { shortD: 1500, longD: 0 },
    assetCashflowReinvest: { shortA: 200, longA: 0, realA: 0 },
    debts: [
      {
        id: "debt1",
        principalToday: 1500,
        annualInterestRate: 0.1,
        annualPayment: 150 + 1000,
        availability: "3m_3y",
        interestSourceInstrumentId: "sys_liq_main",
        amortizationSourceInstrumentId: "sys_liq_main",
      },
    ],
    positions: [
      { id: "sys_liq_main", kind: "asset", bucket: "instant" },
      { id: "pos_short", kind: "asset", bucket: "3m_3y" },
    ],
  });

  const input5Years = makeInput({
    baseYear: 2026,
    planToAge: 45,
    assetsToday: { liq: 500, shortA: 5250, longA: 0, realA: 0 },
    debtsToday: { shortD: 1500, longD: 0 },
    assetCashflowReinvest: { shortA: 200, longA: 0, realA: 0 },
    debts: [
      {
        id: "debt1",
        principalToday: 1500,
        annualInterestRate: 0.1,
        annualPayment: 150 + 1000,
        availability: "3m_3y",
        interestSourceInstrumentId: "sys_liq_main",
        amortizationSourceInstrumentId: "sys_liq_main",
      },
    ],
    positions: [
      { id: "sys_liq_main", kind: "asset", bucket: "instant" },
      { id: "pos_short", kind: "asset", bucket: "3m_3y" },
    ],
  });

  it("1. Start-Zustand passt", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row).toBeDefined();
    expect(row.start?.liq).toBe(500);
    expect(row.start?.shortA).toBe(5250);
    expect(row.start?.shortD).toBe(1500);
    const assetsStart = (row.start?.liq ?? 0) + (row.start?.shortA ?? 0) + (row.start?.longA ?? 0) + (row.start?.realA ?? 0);
    const debtsStart = (row.start?.shortD ?? 0) + (row.start?.longD ?? 0);
    expect(assetsStart).toBe(5750);
    expect(debtsStart).toBe(1500);
    expect(assetsStart - debtsStart).toBe(4250);
  });

  it("2. Ende-Zustand nach einem Jahr", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row).toBeDefined();
    expect(row.liq).toBe(0);
    expect(row.shortA).toBe(4800);
    expect(row.shortD).toBe(500);
    const assetsEnd = row.liq + row.shortA + row.longA + row.realA;
    const debtsEnd = (row.shortD ?? 0) + (row.longD ?? 0);
    expect(assetsEnd).toBe(4800);
    expect(debtsEnd).toBe(500);
    expect(assetsEnd - debtsEnd).toBe(4300);
  });

  it("3. Zinsen-Quelle: LIQ 150", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.transferInterestFrom?.liq).toBe(150);
    expect(row?.transferInterestFrom?.shortA).toBe(0);
    expect(row?.debtInterest).toBe(150);
  });

  it("4. Tilgung-Quelle: LIQ 350, Kurzfr. 650", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.transferAmortFrom?.liq).toBe(350);
    expect(row?.transferAmortFrom?.shortA).toBe(650);
    expect(row?.debtAmort).toBe(1000);
  });

  it("5. Herleitung: Liquidität -500 = -150 Zinsen - 350 Tilgung", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    const deltaLiq = (row?.liq ?? 0) - (row?.start?.liq ?? 0);
    expect(deltaLiq).toBe(-500);
    expect(row?.transferInterestFrom?.liq).toBe(150);
    expect(row?.transferAmortFrom?.liq).toBe(350);
  });

  it("6. Herleitung: Kurzfristig -450 = +200 Reinvest - 650 Tilgung", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    const deltaShort = (row?.shortA ?? 0) - (row?.start?.shortA ?? 0);
    expect(deltaShort).toBe(-450);
    expect(row?.assetCashflowReinvestBreakdown?.shortA).toBe(200);
    expect(row?.transferAmortFrom?.shortA).toBe(650);
  });

  it("7. Ende-Zustand nach 5 Jahren", () => {
    const r = computeForecastWithBreakdown(input5Years);
    expect(r.rows).toHaveLength(5);
    const row = r.rows?.[4] as any;
    expect(row).toBeDefined();
    expect(row.year).toBe(2030);
    expect(row.liq).toBe(0);
    expect(row.shortD).toBe(0);
    const assetsEnd = row.liq + row.shortA + row.longA + row.realA;
    const debtsEnd = (row.shortD ?? 0) + (row.longD ?? 0);
    expect(assetsEnd).toBe(5050);
    expect(debtsEnd).toBe(0);
    expect(assetsEnd - debtsEnd).toBe(5050);
  });
});

/**
 * Ausgangslage 2 (Sheet): kurzfristige + langfristige Schulden, Cashflow to Liq 20k, Reinvest 500
 * - Aktiven Start: 2'470'000 (LIQ 500, Kurzfr. 9'500, Langfr. 60'000, Sachwerte 2'400'000)
 * - Passiven Start: 1'250'000 (Kurzfr. 5'000, Langfr. 1'245'000)
 * - Zinsen 0.7% auf 1'245'000 = 8'715 (Quelle: LIQ)
 * - Tilgung Kurzfr. 5'000 + Langfr. 5'600 jährlich (Quelle: LIQ)
 * - Cashflow to Liq: 20'000, Reinvest Kurzfr.: 500
 *
 * Erwartet Jahr 1: LIQ 1'185, Kurzfr. 10'000, Langfr. Passiven 1'239'400, Eigenkapital 1'231'785
 * Erwartet Jahr 5: Langfr. Passiven 1'217'000, Eigenkapital 1'279'319
 */
describe("Ausgangslage 2 – Resultatvergleich", () => {
  const input = inputFromSheet(SHEET_AUSGANGSLAGEN.ausgangslage2);

  it("1. Start-Zustand passt", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row).toBeDefined();
    expect(row.start?.liq).toBe(500);
    expect(row.start?.shortA).toBe(9_500);
    expect(row.start?.longA).toBe(60_000);
    expect(row.start?.realA).toBe(2_400_000);
    expect(row.start?.shortD).toBe(5_000);
    expect(row.start?.longD).toBe(1_245_000);
    const assetsStart = (row.start?.liq ?? 0) + (row.start?.shortA ?? 0) + (row.start?.longA ?? 0) + (row.start?.realA ?? 0);
    const debtsStart = (row.start?.shortD ?? 0) + (row.start?.longD ?? 0);
    expect(assetsStart).toBe(2_470_000);
    expect(debtsStart).toBe(1_250_000);
    expect(assetsStart - debtsStart).toBe(1_220_000);
  });

  it("2. Ende-Zustand nach einem Jahr", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.liq).toBe(1_185);
    expect(row.shortA).toBe(10_000);
    expect(row.longA).toBe(60_000);
    expect(row.realA).toBe(2_400_000);
    expect(row.shortD).toBe(0);
    expect(row.longD).toBe(1_239_400);
    const assetsEnd = row.liq + row.shortA + row.longA + row.realA;
    const debtsEnd = (row.shortD ?? 0) + (row.longD ?? 0);
    expect(assetsEnd).toBe(2_471_185);
    expect(debtsEnd).toBe(1_239_400);
    expect(assetsEnd - debtsEnd).toBe(1_231_785);
  });

  it("3. Zinsen-Quelle: LIQ 8'715 (0.7% auf Langfr.)", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.transferInterestFrom?.liq).toBe(8_715);
    expect(row?.transferInterestFrom?.shortA).toBe(0);
    expect(row?.debtInterest).toBe(8_715);
  });

  it("4. Tilgung-Quelle: LIQ 10'600 (Kurzfr. 5'000 + Langfr. 5'600)", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row?.transferAmortFrom?.liq).toBe(10_600);
    expect(row?.transferAmortFrom?.shortA).toBe(0);
    expect(row?.debtAmort).toBe(10_600);
  });

  it("5. Herleitung Liquidität: +685 = +20'000 Cashflow - 8'715 Zinsen - 10'600 Tilgung", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    const deltaLiq = (row?.liq ?? 0) - (row?.start?.liq ?? 0);
    expect(deltaLiq).toBe(685);
  });

  it("6. Herleitung Kurzfristig: +500 = +500 Reinvest", () => {
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    const deltaShort = (row?.shortA ?? 0) - (row?.start?.shortA ?? 0);
    expect(deltaShort).toBe(500);
    expect(row?.assetCashflowReinvestBreakdown?.shortA).toBe(500);
  });

  it("7. Ende-Zustand nach 5 Jahren", () => {
    const sheet5Years = { ...SHEET_AUSGANGSLAGEN.ausgangslage2, horizonYears: 5 };
    const input5Years = inputFromSheet(sheet5Years);
    const r = computeForecastWithBreakdown(input5Years);
    expect(r.rows).toHaveLength(5);
    const row = r.rows?.[4] as any;
    expect(row).toBeDefined();
    expect(row.year).toBe(2030);
    expect(row.shortD).toBe(0);
    expect(row.longD).toBe(1_217_000);
    const assetsEnd = row.liq + row.shortA + row.longA + row.realA;
    const debtsEnd = (row.shortD ?? 0) + (row.longD ?? 0);
    expect(assetsEnd - debtsEnd).toBe(1_279_319);
  });
});

// =====================================================================
// Transfer Events
// =====================================================================

function makeTransferEvent(overrides: Record<string, unknown> = {}): any {
  return {
    client_id: "tf_1",
    title: "Transfer Test",
    start_date: "2026-01-01",
    end_date: null,
    recurrence: "none",
    active: 1,
    meta_json: null,
    line: {
      line_type: "transfer",
      amount_chf: 0,
      indexation: null,
      category: null,
      meta_json: null,
      transferFromKey: "liquidity",
      transferToKey: "liquidity",
      ...(overrides.line as object ?? {}),
    },
    ...overrides,
    // re-apply line after spread so overrides.line merges correctly
  };
}

describe("Transfer Events – Grundlagen", () => {
  it("Transfer Liquidität → Kurzfristig verschiebt Betrag korrekt", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 10_000, shortA: 5_000, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          title: "Investieren",
          line: { line_type: "transfer", amount_chf: 3_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.liq).toBe(7_000);
    expect(row.shortA).toBe(8_000);
  });

  it("Transfer Kurzfristig → Langfristig verschiebt zwischen Buckets", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 1_000, shortA: 20_000, longA: 10_000, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          title: "Umschichten",
          line: { line_type: "transfer", amount_chf: 5_000, indexation: null, category: null, meta_json: null, transferFromKey: "asset:pos_short", transferToKey: "asset:pos_long" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.shortA).toBe(15_000);
    expect(row.longA).toBe(15_000);
    expect(row.liq).toBe(1_000);
  });

  it("Transfer verändert weder Einnahmen noch Ausgaben", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 10_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          title: "Interne Umbuchung",
          line: { line_type: "transfer", amount_chf: 2_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.eventsIncome ?? 0).toBe(0);
    expect(row.eventsExpense ?? 0).toBe(0);
  });

  it("Transfer wird in eventTransfers mit fromKey/toKey gemeldet", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 10_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          title: "Reinvest",
          line: { line_type: "transfer", amount_chf: 4_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_long" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.eventTransfers).toHaveLength(1);
    expect(row.eventTransfers[0].label).toBe("Reinvest");
    expect(row.eventTransfers[0].amount).toBe(4_000);
    expect(row.eventTransfers[0].fromKey).toBe("liquidity");
    expect(row.eventTransfers[0].toKey).toBe("asset:pos_long");
  });

  it("Eigenkapital bleibt bei Asset→Asset Transfer unverändert", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 10_000, shortA: 5_000, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          title: "Umschichten",
          line: { line_type: "transfer", amount_chf: 3_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    const equityStart = 10_000 + 5_000;
    const equityEnd = row.liq + row.shortA + row.longA + row.realA;
    expect(equityEnd).toBe(equityStart);
  });
});

describe("Transfer Events – Schulden-Rückzahlung (Asset → Debt)", () => {
  it("Transfer Liquidität → Schuld reduziert den Schuld-Principal", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 100_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 60_000 },
      positions: [
        ...DEFAULT_POSITIONS,
        { id: "darlehen_hw", kind: "debt", availability: "gt_3y" },
      ],
      debts: [
        {
          id: "darlehen_hw",
          principalToday: 60_000,
          annualInterestRate: 0,
          annualPayment: 0,
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        makeTransferEvent({
          title: "Darlehen H&W tilgen",
          line: { line_type: "transfer", amount_chf: 60_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "debt:darlehen_hw" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.liq).toBe(40_000);
    expect(row.longD).toBe(0);
    const equity = row.liq + row.shortA + row.longA + row.realA - (row.shortD ?? 0) - (row.longD ?? 0);
    expect(equity).toBe(40_000);
  });

  it("Teilrückzahlung einer Schuld", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 50_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 100_000 },
      positions: [
        ...DEFAULT_POSITIONS,
        { id: "hypo1", kind: "debt", availability: "gt_3y" },
      ],
      debts: [
        {
          id: "hypo1",
          principalToday: 100_000,
          annualInterestRate: 0,
          annualPayment: 0,
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        makeTransferEvent({
          title: "Sondertilgung",
          line: { line_type: "transfer", amount_chf: 30_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "debt:hypo1" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.liq).toBe(20_000);
    expect(row.longD).toBe(70_000);
  });
});

describe("Transfer Events – Kreditaufnahme (Debt → Asset)", () => {
  it("Transfer Schuld → Liquidität erhöht Schuld und LIQ", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 5_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: [
        ...DEFAULT_POSITIONS,
        { id: "kredit_neu", kind: "debt", availability: "3m_3y" },
      ],
      debts: [
        {
          id: "kredit_neu",
          principalToday: 0,
          annualInterestRate: 0,
          annualPayment: 0,
          availability: "3m_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        makeTransferEvent({
          title: "Kredit aufnehmen",
          line: { line_type: "transfer", amount_chf: 20_000, indexation: null, category: null, meta_json: null, transferFromKey: "debt:kredit_neu", transferToKey: "liquidity" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.liq).toBe(25_000);
    expect(row.shortD).toBe(20_000);
  });
});

describe("Transfer Events – Zeitverhalten", () => {
  it("Einmaliger Transfer nur im Startjahr aktiv", () => {
    const input = makeInput({
      planToAge: 43,
      assetsToday: { liq: 50_000, shortA: 10_000, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          title: "Einmal-Invest",
          start_date: "2027-06-01",
          recurrence: "none",
          line: { line_type: "transfer", amount_chf: 10_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row0 = r.rows?.[0] as any; // 2026
    const row1 = r.rows?.[1] as any; // 2027
    const row2 = r.rows?.[2] as any; // 2028
    expect(row0.eventTransfers ?? []).toHaveLength(0);
    expect(row1.eventTransfers).toHaveLength(1);
    expect(row1.liq).toBe(40_000);
    expect(row1.shortA).toBe(20_000);
    expect(row2.eventTransfers ?? []).toHaveLength(0);
    expect(row2.liq).toBe(40_000);
  });

  it("Jährlicher Transfer wiederholt sich über Laufzeit", () => {
    const input = makeInput({
      planToAge: 43,
      assetsToday: { liq: 100_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          title: "Jahres-Sparplan",
          start_date: "2026-01-01",
          end_date: "2028-12-31",
          recurrence: "yearly",
          line: { line_type: "transfer", amount_chf: 12_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    expect(r.rows?.[0]?.eventTransfers).toHaveLength(1);
    expect(r.rows?.[1]?.eventTransfers).toHaveLength(1);
    expect(r.rows?.[2]?.eventTransfers).toHaveLength(1);
    const row2 = r.rows?.[2] as any;
    expect(row2.liq).toBe(64_000);
    expect(row2.shortA).toBe(36_000);
  });
});

describe("Transfer Events – Mehrere Transfers im selben Jahr", () => {
  it("Zwei Transfers im selben Jahr werden korrekt verarbeitet", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 50_000, shortA: 10_000, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        makeTransferEvent({
          client_id: "tf_a",
          title: "Invest A",
          line: { line_type: "transfer", amount_chf: 5_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
        makeTransferEvent({
          client_id: "tf_b",
          title: "Invest B",
          line: { line_type: "transfer", amount_chf: 10_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_long" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.eventTransfers).toHaveLength(2);
    expect(row.liq).toBe(35_000);
    expect(row.shortA).toBe(15_000);
    expect(row.longA).toBe(10_000);
  });
});

describe("Transfer Events – Kombination mit Annuals und regulären Events", () => {
  it("Transfer + Einnahme + Ausgabe ergibt korrektes Ergebnis", () => {
    const input = makeInput({
      planToAge: 41,
      assetsToday: { liq: 20_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: DEFAULT_POSITIONS,
      events: [
        {
          client_id: "ev_income",
          title: "Bonus",
          start_date: "2026-01-01",
          end_date: null,
          recurrence: "none",
          active: 1,
          meta_json: null,
          line: { line_type: "income", amount_chf: 10_000, indexation: null, category: null, meta_json: null, destination: "liquidity" },
        },
        {
          client_id: "ev_expense",
          title: "Auto",
          start_date: "2026-01-01",
          end_date: null,
          recurrence: "none",
          active: 1,
          meta_json: null,
          line: { line_type: "spending", amount_chf: 5_000, indexation: null, category: null, meta_json: null },
        },
        makeTransferEvent({
          client_id: "ev_transfer",
          title: "Sparen",
          line: { line_type: "transfer", amount_chf: 8_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    const row = r.rows?.[0] as any;
    expect(row.eventsIncome).toBe(10_000);
    expect(row.eventsExpense).toBe(5_000);
    expect(row.eventTransfers).toHaveLength(1);
    // LIQ: 20k + 10k (income) - 5k (expense) - 8k (transfer) = 17k
    expect(row.liq).toBe(17_000);
    expect(row.shortA).toBe(8_000);
  });
});

describe("Transfer Events – Invarianten", () => {
  it("Bilanz und Kontinuität halten bei Transfers über 5 Jahre", () => {
    const input = makeInput({
      planToAge: 45,
      assetsToday: { liq: 100_000, shortA: 50_000, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 80_000 },
      positions: [
        ...DEFAULT_POSITIONS,
        { id: "hypo", kind: "debt", availability: "gt_3y" },
      ],
      debts: [
        {
          id: "hypo",
          principalToday: 80_000,
          annualInterestRate: 0.02,
          annualPayment: 1_600,
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        makeTransferEvent({
          client_id: "tf_invest",
          title: "Jährliches Sparen",
          start_date: "2026-01-01",
          end_date: "2030-12-31",
          recurrence: "yearly",
          line: { line_type: "transfer", amount_chf: 5_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:pos_short" },
        }),
        makeTransferEvent({
          client_id: "tf_tilgung",
          title: "Extra-Tilgung",
          start_date: "2028-01-01",
          recurrence: "none",
          line: { line_type: "transfer", amount_chf: 10_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "debt:hypo" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);
    expect(r.rows).toHaveLength(5);
  });
});

// =====================================================================
// Anwendungsfälle – Realistische Szenarien
// =====================================================================

describe("Anwendungsfall: Vorsorge-Entnahme → ETF (leere Position ab 2030)", () => {
  const POSITIONS = [
    { id: "sys_liq_main", kind: "asset", bucket: "instant" },
    { id: "etf_sparplan", kind: "asset", bucket: "3m_3y" },
    { id: "saeule_3a", kind: "asset", bucket: "locked" },
  ] as const;

  it("ETF startet mit 0 und wird ab 2030 durch 3a-Entnahme aufgefüllt", () => {
    const input = makeInput({
      planToAge: 46, // 6 Jahre: 2026–2031
      assetsToday: { liq: 30_000, shortA: 0, longA: 0, realA: 80_000 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: POSITIONS,
      events: [
        makeTransferEvent({
          client_id: "tf_3a_etf",
          title: "Entnahme 3a → ETF",
          start_date: "2030-01-01",
          recurrence: "none",
          line: { line_type: "transfer", amount_chf: 50_000, indexation: null, category: null, meta_json: null, transferFromKey: "asset:saeule_3a", transferToKey: "asset:etf_sparplan" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    // 2026–2029: keine Transfers, alles unverändert
    for (let i = 0; i < 4; i++) {
      const row = r.rows?.[i] as any;
      expect(row.shortA).toBe(0);
      expect(row.realA).toBe(80_000);
      expect(row.eventTransfers ?? []).toHaveLength(0);
    }

    // 2030: Transfer greift
    const row2030 = r.rows?.[4] as any;
    expect(row2030.year).toBe(2030);
    expect(row2030.shortA).toBe(50_000);
    expect(row2030.realA).toBe(30_000);
    expect(row2030.eventTransfers).toHaveLength(1);

    // Gesamtvermögen bleibt gleich (reine Umschichtung)
    const totalAssets = row2030.liq + row2030.shortA + row2030.longA + row2030.realA;
    expect(totalAssets).toBe(30_000 + 80_000);
  });

  it("Jährliche 3a-Entnahmen ab 2028 über 3 Jahre in ETF", () => {
    const input = makeInput({
      planToAge: 46,
      assetsToday: { liq: 20_000, shortA: 0, longA: 0, realA: 120_000 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: POSITIONS,
      events: [
        makeTransferEvent({
          client_id: "tf_3a_etf_yearly",
          title: "3a-Bezug → ETF",
          start_date: "2028-01-01",
          end_date: "2030-12-31",
          recurrence: "yearly",
          line: { line_type: "transfer", amount_chf: 20_000, indexation: null, category: null, meta_json: null, transferFromKey: "asset:saeule_3a", transferToKey: "asset:etf_sparplan" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    // 2026–2027: kein Transfer
    expect((r.rows?.[0] as any).shortA).toBe(0);
    expect((r.rows?.[0] as any).realA).toBe(120_000);
    expect((r.rows?.[1] as any).shortA).toBe(0);

    // 2028: erster Transfer → 20k
    const row2028 = r.rows?.[2] as any;
    expect(row2028.shortA).toBe(20_000);
    expect(row2028.realA).toBe(100_000);

    // 2029: zweiter → 40k
    const row2029 = r.rows?.[3] as any;
    expect(row2029.shortA).toBe(40_000);
    expect(row2029.realA).toBe(80_000);

    // 2030: dritter → 60k
    const row2030 = r.rows?.[4] as any;
    expect(row2030.shortA).toBe(60_000);
    expect(row2030.realA).toBe(60_000);

    // Total bleibt immer 140k
    const total = row2030.liq + row2030.shortA + row2030.longA + row2030.realA;
    expect(total).toBe(140_000);
  });
});

describe("Anwendungsfall: ETF-Sparplan aus Liquidität + späterer Teilverkauf", () => {
  const POSITIONS = [
    { id: "sys_liq_main", kind: "asset", bucket: "instant" },
    { id: "etf_global", kind: "asset", bucket: "3m_3y" },
  ] as const;

  it("Jährliches Sparen → ETF, dann Teilverkauf für Hauskauf", () => {
    const input = makeInput({
      planToAge: 46, // 6 Jahre
      assetsToday: { liq: 80_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 0 },
      positions: POSITIONS,
      events: [
        makeTransferEvent({
          client_id: "tf_sparplan",
          title: "ETF-Sparplan",
          start_date: "2026-01-01",
          end_date: "2031-12-31",
          recurrence: "yearly",
          line: { line_type: "transfer", amount_chf: 10_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:etf_global" },
        }),
        makeTransferEvent({
          client_id: "tf_verkauf",
          title: "ETF-Verkauf Hauskauf-EK",
          start_date: "2029-01-01",
          recurrence: "none",
          line: { line_type: "transfer", amount_chf: 25_000, indexation: null, category: null, meta_json: null, transferFromKey: "asset:etf_global", transferToKey: "liquidity" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    // 2026: LIQ 80k - 10k = 70k, ETF = 10k
    expect((r.rows?.[0] as any).liq).toBe(70_000);
    expect((r.rows?.[0] as any).shortA).toBe(10_000);

    // 2027: LIQ 60k, ETF 20k
    expect((r.rows?.[1] as any).liq).toBe(60_000);
    expect((r.rows?.[1] as any).shortA).toBe(20_000);

    // 2028: LIQ 50k, ETF 30k
    expect((r.rows?.[2] as any).liq).toBe(50_000);
    expect((r.rows?.[2] as any).shortA).toBe(30_000);

    // 2029: Sparplan +10k → ETF 40k, dann Verkauf -25k → ETF 15k
    //        LIQ: 50k -10k +25k = 65k (Reihenfolge: Sparplan zuerst, Verkauf danach)
    const row2029 = r.rows?.[3] as any;
    expect(row2029.eventTransfers).toHaveLength(2);
    expect(row2029.shortA).toBe(15_000);
    expect(row2029.liq).toBe(65_000);

    // Total immer 80k
    const total = row2029.liq + row2029.shortA + row2029.longA + row2029.realA;
    expect(total).toBe(80_000);
  });
});

describe("Anwendungsfall: Hypothek-Sondertilgung aus Kurzfristig-Vermögen", () => {
  const POSITIONS = [
    { id: "sys_liq_main", kind: "asset", bucket: "instant" },
    { id: "wertschriften", kind: "asset", bucket: "3m_3y" },
    { id: "hypo_haus", kind: "debt", availability: "gt_3y" },
  ] as const;

  it("Sondertilgung reduziert Schuld und senkt folgende Zinslast", () => {
    const input = makeInput({
      planToAge: 43, // 3 Jahre
      assetsToday: { liq: 20_000, shortA: 100_000, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 500_000 },
      positions: POSITIONS,
      debts: [
        {
          id: "hypo_haus",
          principalToday: 500_000,
          annualInterestRate: 0.015, // 1.5%
          annualPayment: 7_500 + 5_000, // 7500 Zinsen + 5000 Tilgung
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        makeTransferEvent({
          client_id: "tf_sondertilgung",
          title: "Sondertilgung aus Wertschriften",
          start_date: "2027-01-01",
          recurrence: "none",
          line: { line_type: "transfer", amount_chf: 50_000, indexation: null, category: null, meta_json: null, transferFromKey: "asset:wertschriften", transferToKey: "debt:hypo_haus" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    // 2026: reguläre Tilgung 5k, Zinsen 7500 → Schuld 495k
    const row0 = r.rows?.[0] as any;
    expect(row0.longD).toBe(495_000);
    expect(row0.debtInterest).toBe(7_500);

    // 2027: Sondertilgung 50k + reguläre Tilgung (5k, teils aus shortA wegen LIQ-Deficit)
    const row1 = r.rows?.[1] as any;
    expect(row1.eventTransfers).toHaveLength(1);
    // shortA: 100k - 50k (Transfer) - 4,925 (Tilgungs-Deficit aus shortA) = 45,075
    expect(row1.shortA).toBe(45_075);
    expect(row1.longD).toBe(440_000); // 495k - 50k Sondertilgung - 5k reguläre Tilgung

    // 2028: Zinsen auf reduziertem Principal (440k * 1.5% = 6,600)
    const row2 = r.rows?.[2] as any;
    expect(row2.debtInterest).toBe(6_600);
  });
});

describe("Anwendungsfall: Erbschaft → Schuld tilgen + Rest investieren", () => {
  const POSITIONS = [
    { id: "sys_liq_main", kind: "asset", bucket: "instant" },
    { id: "etf_nachhaltig", kind: "asset", bucket: "3m_3y" },
    { id: "konsumkredit", kind: "debt", availability: "3m_3y" },
  ] as const;

  it("Erbschaft als Einnahme, dann Transfer zur Tilgung und Investment", () => {
    const input = makeInput({
      planToAge: 42, // 2 Jahre
      assetsToday: { liq: 10_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 30_000, longD: 0 },
      positions: POSITIONS,
      debts: [
        {
          id: "konsumkredit",
          principalToday: 30_000,
          annualInterestRate: 0.05,
          annualPayment: 1_500, // nur Zinsen
          availability: "3m_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        // Erbschaft als Einnahme → LIQ
        {
          client_id: "ev_erbschaft",
          title: "Erbschaft",
          start_date: "2026-01-01",
          end_date: null,
          recurrence: "none",
          active: 1,
          meta_json: null,
          line: { line_type: "income", amount_chf: 80_000, indexation: null, category: null, meta_json: null, destination: "liquidity" },
        },
        // Transfer: Kredit komplett tilgen
        makeTransferEvent({
          client_id: "tf_tilgung",
          title: "Konsumkredit tilgen",
          line: { line_type: "transfer", amount_chf: 30_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "debt:konsumkredit" },
        }),
        // Transfer: Rest in ETF
        makeTransferEvent({
          client_id: "tf_invest",
          title: "Erbschaft investieren",
          line: { line_type: "transfer", amount_chf: 40_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:etf_nachhaltig" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    const row0 = r.rows?.[0] as any;
    // LIQ: 10k + 80k (Erbschaft) - 1.5k (Zinsen auf 30k) - 30k (Tilgung Transfer) - 40k (ETF Transfer) = 18.5k
    // Aber reguläre Tilgung/Zinsen laufen in anderer Phase – Reihenfolge beachten
    expect(row0.eventsIncome).toBe(80_000);
    expect(row0.eventTransfers).toHaveLength(2);
    expect(row0.shortD).toBe(0); // Kredit komplett getilgt
    expect(row0.shortA).toBe(40_000); // ETF aufgebaut

    // 2027: keine Zinsen mehr auf Kredit
    const row1 = r.rows?.[1] as any;
    expect(row1.debtInterest).toBe(0);
    expect(row1.shortD).toBe(0);
  });
});

// =====================================================================
// Per-Debt Amortisation (kein Pooling)
// =====================================================================

describe("Amortisation – nur die eigene Schuld wird getilgt (kein Pooling)", () => {
  const POSITIONS = [
    { id: "sys_liq_main", kind: "asset", bucket: "instant" },
    { id: "pos_short", kind: "asset", bucket: "3m_3y" },
    { id: "saeule_3a", kind: "asset", bucket: "locked" },
    { id: "hypo_efh", kind: "debt", availability: "gt_3y" },
    { id: "darlehen_hw", kind: "debt", availability: "gt_3y" },
  ] as const;

  it("Schuld ohne Amortisation behält ihren Saldo über die Jahre", () => {
    const input = makeInput({
      planToAge: 45, // 5 Jahre
      assetsToday: { liq: 50_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 560_000 },
      positions: POSITIONS,
      debts: [
        {
          id: "hypo_efh",
          principalToday: 500_000,
          annualInterestRate: 0.01,
          annualPayment: 5_000 + 10_000, // 5k Zinsen + 10k Tilgung
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
        {
          id: "darlehen_hw",
          principalToday: 60_000,
          annualInterestRate: 0,
          annualPayment: 0, // KEINE Amortisation
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    // Darlehen hat keine Amortisation → longD sinkt nur um Hypo-Tilgung (10k/Jahr)
    const row0 = r.rows?.[0] as any;
    expect(row0.longD).toBe(550_000); // 560k - 10k (nur Hypo)
    expect(row0.debtAmort).toBe(10_000);

    const row4 = r.rows?.[4] as any;
    expect(row4.longD).toBe(510_000); // 560k - 5*10k = 510k (Darlehen bleibt bei 60k)
  });

  it("Transfer auf Schuld ohne Amortisation reduziert korrekt (Darlehen-II-Bug)", () => {
    const input = makeInput({
      planToAge: 45, // 5 Jahre: 2026–2030
      assetsToday: { liq: 50_000, shortA: 0, longA: 0, realA: 60_000 },
      debtsToday: { shortD: 0, longD: 560_000 },
      positions: POSITIONS,
      debts: [
        {
          id: "hypo_efh",
          principalToday: 500_000,
          annualInterestRate: 0.01,
          annualPayment: 5_000 + 10_000, // 5k Zinsen + 10k Tilgung
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
        {
          id: "darlehen_hw",
          principalToday: 60_000,
          annualInterestRate: 0,
          annualPayment: 0, // KEINE Amortisation
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        makeTransferEvent({
          client_id: "tf_3a_darlehen",
          title: "Säule 3a → Darlehen tilgen",
          start_date: "2030-01-01",
          recurrence: "none",
          line: {
            line_type: "transfer",
            amount_chf: 60_000,
            indexation: null,
            category: null,
            meta_json: null,
            transferFromKey: "asset:saeule_3a",
            transferToKey: "debt:darlehen_hw",
          },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    // 2026–2029: Darlehen bleibt bei 60k, nur Hypo wird getilgt
    for (let i = 0; i < 4; i++) {
      const row = r.rows?.[i] as any;
      const hypoExpected = 500_000 - (i + 1) * 10_000;
      expect(row.longD).toBe(hypoExpected + 60_000);
    }

    // 2030: Transfer greift → Darlehen wird auf 0 reduziert
    const row2030 = r.rows?.[4] as any;
    expect(row2030.year).toBe(2030);
    expect(row2030.eventTransfers).toHaveLength(1);
    // Hypo: 500k - 5*10k = 450k, Darlehen: 60k - 60k = 0
    expect(row2030.longD).toBe(450_000);
    // Sachwerte: 60k - 60k (Transfer) = 0
    expect(row2030.realA).toBe(0);
  });

  it("Mehrere Schulden mit unterschiedlicher Amortisation – jede nur ihre eigene", () => {
    const POSITIONS_3DEBTS = [
      { id: "sys_liq_main", kind: "asset", bucket: "instant" },
      { id: "debt_a", kind: "debt", availability: "gt_3y" },
      { id: "debt_b", kind: "debt", availability: "gt_3y" },
      { id: "debt_c", kind: "debt", availability: "gt_3y" },
    ] as const;

    const input = makeInput({
      planToAge: 42, // 2 Jahre
      assetsToday: { liq: 200_000, shortA: 0, longA: 0, realA: 0 },
      debtsToday: { shortD: 0, longD: 300_000 },
      positions: POSITIONS_3DEBTS,
      debts: [
        {
          id: "debt_a",
          principalToday: 100_000,
          annualInterestRate: 0.02,
          annualPayment: 2_000 + 20_000, // 2k Zinsen + 20k Tilgung
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
        {
          id: "debt_b",
          principalToday: 150_000,
          annualInterestRate: 0.01,
          annualPayment: 1_500 + 5_000, // 1.5k Zinsen + 5k Tilgung
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
        {
          id: "debt_c",
          principalToday: 50_000,
          annualInterestRate: 0.03,
          annualPayment: 1_500, // NUR Zinsen, 0 Tilgung
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    // Jahr 1: debt_a -20k, debt_b -5k, debt_c bleibt → 300k - 25k = 275k
    const row0 = r.rows?.[0] as any;
    expect(row0.longD).toBe(275_000);
    expect(row0.debtAmort).toBe(25_000);
    // Zinsen: 2k + 1.5k + 1.5k = 5k
    expect(row0.debtInterest).toBe(5_000);

    // Jahr 2: debt_a -20k (→60k), debt_b -5k (→140k), debt_c bleibt (→50k) → 250k
    const row1 = r.rows?.[1] as any;
    expect(row1.longD).toBe(250_000);
    // Zinsen auf reduzierte Principals: 80k*2% + 145k*1% + 50k*3% = 1600 + 1450 + 1500 = 4550
    expect(row1.debtInterest).toBe(4_550);
  });
});

describe("Anwendungsfall: Renovation finanzieren mit Hypothek-Aufstockung", () => {
  const POSITIONS = [
    { id: "sys_liq_main", kind: "asset", bucket: "instant" },
    { id: "pos_short", kind: "asset", bucket: "3m_3y" },
    { id: "immobilie", kind: "asset", bucket: "locked" },
    { id: "hypo", kind: "debt", availability: "gt_3y" },
  ] as const;

  it("Hypo-Aufstockung (Debt→LIQ) + Renovation (Ausgabe) + Wertsteigerung (Transfer LIQ→Immobilie)", () => {
    const input = makeInput({
      planToAge: 42, // 2 Jahre
      assetsToday: { liq: 15_000, shortA: 0, longA: 0, realA: 400_000 },
      debtsToday: { shortD: 0, longD: 300_000 },
      positions: POSITIONS,
      debts: [
        {
          id: "hypo",
          principalToday: 300_000,
          annualInterestRate: 0.015,
          annualPayment: 4_500, // Zinsen only
          availability: "gt_3y",
          interestSourceInstrumentId: "sys_liq_main",
          amortizationSourceInstrumentId: "sys_liq_main",
        },
      ],
      events: [
        // Hypo aufstocken: 50k neue Schuld → LIQ
        makeTransferEvent({
          client_id: "tf_hypo_aufstockung",
          title: "Hypothek aufstocken",
          line: { line_type: "transfer", amount_chf: 50_000, indexation: null, category: null, meta_json: null, transferFromKey: "debt:hypo", transferToKey: "liquidity" },
        }),
        // Renovation als Ausgabe
        {
          client_id: "ev_renovation",
          title: "Renovation Küche/Bad",
          start_date: "2026-01-01",
          end_date: null,
          recurrence: "none",
          active: 1,
          meta_json: null,
          line: { line_type: "spending", amount_chf: 45_000, indexation: null, category: null, meta_json: null },
        },
        // Wertsteigerung der Immobilie
        makeTransferEvent({
          client_id: "tf_wertsteigerung",
          title: "Wertsteigerung Immobilie",
          line: { line_type: "transfer", amount_chf: 30_000, indexation: null, category: null, meta_json: null, transferFromKey: "liquidity", transferToKey: "asset:immobilie" },
        }),
      ],
    });
    const r = computeForecastWithBreakdown(input);
    assertInvariants(r.rows ?? []);

    const row0 = r.rows?.[0] as any;
    // Schuld: 300k + 50k Aufstockung = 350k (minus evtl. reguläre Tilgung 0 da annualPayment=4500=Zinsen)
    expect(row0.longD).toBe(350_000);
    // Renovation zieht 30k aus realA (Deficit-Coverage), Wertsteigerung +30k → netto 0
    expect(row0.realA).toBe(400_000);
    expect(row0.eventTransfers).toHaveLength(2);

    // 2027: Zinsen auf 350k (1.5% = 5250, aufgerundet wegen Engine-Rundung)
    const row1 = r.rows?.[1] as any;
    expect(row1.debtInterest).toBe(5_250);
  });
});
