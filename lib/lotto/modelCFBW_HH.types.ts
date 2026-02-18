// ==========================================
// file: src/lib/lotto/modelCFBW_HH.types.ts
// Only the import path changes vs previous
// (ensure these exports exist in your file)
// ==========================================

// export { createEmptyDraft, addChild, removeChild, draftToModel1Input, newId, todayBaseYear } ...
// (keep your implementation; page.tsx imports these)


import type {
  Asset,
  Assumptions,
  ChildDraft,
  DateISO,
  Household,
  IncomeLine,
  Model1DraftState,
  SpendingAdjustmentDraft,
  PensionDraft,
  PensionSource,
  ExpenseLine,
  Model1Input,
  PartnerDraft,
  Person,
  ValidationIssue,
  ValidationResult,
} from "./types";

/** Prefer using crypto.randomUUID() in the browser; fallback provided for older environments. */
export function newId(): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function todayBaseYear(): number {
  return new Date().getFullYear();
}

// ----------------------------
// Helpers: date parsing + age
// ----------------------------

export function parseISODate(d: DateISO): Date | null {
  // Strict-ish: YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return null;
  if (mo < 1 || mo > 12) return null;
  if (da < 1 || da > 31) return null;

  const dt = new Date(Date.UTC(y, mo - 1, da));
  // Guard against overflow (e.g. 2025-02-31)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== da) return null;
  return dt;
}

export function ageAtYear(birthYear: number, year: number): number {
  return year - birthYear;
}

export function birthYearFromBirthDate(d: DateISO): number | null {
  const dt = parseISODate(d);
  if (!dt) return null;
  return dt.getUTCFullYear();
}

// ----------------------------
// Defaults for draft creation
// ----------------------------

export function createEmptyDraft(): Model1DraftState {
  const selfId = newId();
  const partnerId = newId();

  return {
    household: {
      self: {
        id: selfId,
        label: "Ich",
        birthYear: 1980,
        retireNow: true,
        retireAtAge: 65, // IMPORTANT: always set (fixes validation issue)
        planToAge: 95,
        extraSafetyYears: 0,
        inHousehold: true,
      },
      partner: {
        enabled: false,
        id: partnerId,
        label: "Partner:in",
        birthYear: undefined,
        birthDate: undefined,
        retireAtAge: 65,
        retireNow: true,
        planToAge: 95,
        extraSafetyYears: 0,
        inHousehold: true,
      },
      children: [],
    },

    spending: {
      annualSpendingToday: 0,
      indexation: "inflation",
      extraGrowth: 0,
      oneOffEvents: [],
      adjustments: [], // NEW
    },

    futureIncome: {
      selfPensions: [],   // NEW type PensionDraft
      partnerPensions: [],
      otherIncomes: [],
    },

    wealth: {
      liquid: 0,
      invested: 0,
      tiedPension: 0,
      realEstate: 0,
      debts: [],
      emergencyReserveToday: 0,
      partnerTiedPension: undefined,
    },

    assumptions: {
      currency: "CHF",
      returnMode: "real",
      realReturn: 0.02,
      inflation: 0.01,
      annualFees: 0.002,
      taxMode: "simple_effective",
      effectiveIncomeTaxRate: 0.12,
      wealthTaxRate: 0.003,
    },
  };
}

export function addChild(draft: Model1DraftState): Model1DraftState {
  const child: ChildDraft = {
    id: newId(),
    label: `Kind ${draft.household.children.length + 1}`,
    birthDate: "2015-01-01",
    inHousehold: true,
    dependent: true,
  };
  return {
    ...draft,
    household: {
      ...draft.household,
      children: [...draft.household.children, child],
    },
  };
}

export function removeChild(draft: Model1DraftState, childId: string): Model1DraftState {
  return {
    ...draft,
    household: {
      ...draft.household,
      children: draft.household.children.filter((c) => c.id !== childId),
    },
  };
}

// ----------------------------
// Validation (Draft -> Input)
// ----------------------------

export function validateDraft(d: Model1DraftState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // self
  if (!Number.isFinite(d.household.self.birthYear) || d.household.self.birthYear < 1900) {
    issues.push({ path: "household.self.birthYear", message: "Ungültiges Geburtsjahr." });
  }
  if (!Number.isFinite(d.household.self.planToAge) || d.household.self.planToAge < 60) {
    issues.push({ path: "household.self.planToAge", message: "Planungsalter ist zu tief." });
  }
  if (!d.household.self.retireNow) {
    if (!Number.isFinite(d.household.self.retireAtAge) || (d.household.self.retireAtAge ?? 0) < 0) {
      issues.push({ path: "household.self.retireAtAge", message: "RetireAtAge fehlt/ungültig." });
    }
  }

  // partner
  if (d.household.partner.enabled) {
    if (!d.household.partner.label.trim()) {
      issues.push({ path: "household.partner.label", message: "Partner-Label fehlt." });
    }
    const by = d.household.partner.birthYear ?? (d.household.partner.birthDate ? birthYearFromBirthDate(d.household.partner.birthDate) : null);
    if (!by || !Number.isFinite(by) || by < 1900) {
      issues.push({ path: "household.partner.birthYear", message: "Partner: Geburtsjahr/-datum fehlt oder ungültig." });
    }
  }

  // children
  d.household.children.forEach((c, idx) => {
    const pathBase = `household.children[${idx}]`;
    if (!c.birthDate) {
      issues.push({ path: `${pathBase}.birthDate`, message: "Geburtsdatum fehlt." });
    } else if (!parseISODate(c.birthDate as DateISO)) {
      issues.push({ path: `${pathBase}.birthDate`, message: "Geburtsdatum ist ungültig (YYYY-MM-DD)." });
    }
    if (!c.label.trim()) {
      issues.push({ path: `${pathBase}.label`, message: "Kind-Label fehlt." });
    }
  });

  // assumptions
  const a = d.assumptions;
  if (a.returnMode === "real") {
    if (typeof a.realReturn !== "number") issues.push({ path: "assumptions.realReturn", message: "Realrendite fehlt." });
  } else {
    if (typeof a.nominalReturn !== "number") issues.push({ path: "assumptions.nominalReturn", message: "Nominalrendite fehlt." });
    if (typeof a.inflation !== "number") issues.push({ path: "assumptions.inflation", message: "Inflation fehlt." });
  }

  return issues;
}

// ----------------------------
// Mapping: Draft -> Model1Input
// ----------------------------

function toPersonSelf(d: Model1DraftState): Person {
  return {
    id: d.household.self.id,
    role: "self",
    label: d.household.self.label,
    birthYear: d.household.self.birthYear,
    inHousehold: true,
    dependent: false,
    retireAtAge: d.household.self.retireNow ? d.household.self.birthYear /* placeholder */ : d.household.self.retireAtAge, // not used yet in v1
    planToAge: d.household.self.planToAge,
    extraSafetyYears: d.household.self.extraSafetyYears,
  };
}

function toPersonPartner(p: PartnerDraft): Person | null {
  if (!p.enabled) return null;
  const by = p.birthYear ?? (p.birthDate ? birthYearFromBirthDate(p.birthDate) : null);
  return {
    id: p.id,
    role: "partner",
    label: p.label,
    birthYear: by ?? undefined,
    birthDate: p.birthDate,
    inHousehold: p.inHousehold,
    dependent: false,
    retireAtAge: p.retireAtAge,
  };
}

function toPersonChild(c: ChildDraft): Person {
  return {
    id: c.id,
    role: "child",
    label: c.label,
    birthDate: c.birthDate,
    birthYear: birthYearFromBirthDate(c.birthDate) ?? undefined,
    inHousehold: c.inHousehold,
    dependent: c.dependent,
  };
}

/**
 * Converts the draft to Model1Input.
 * - Includes household members (dynamic children)
 * - Builds minimal expenses/incomes from spending + otherIncomes
 * - Builds pensions per person (self/partner)
 * - Builds assets from wealth buckets (simple v1)
 */
export function draftToModel1Input(d: Model1DraftState, baseYear = todayBaseYear()): ValidationResult<Model1Input> {
  const issues = validateDraft(d);
  if (issues.length) return { ok: false, issues };

  const selfPerson = toPersonSelf(d);

  const partnerPerson = toPersonPartner(d.household.partner);
  const childPeople = d.household.children.map(toPersonChild);

  const household: Household = {
    members: [selfPerson, ...(partnerPerson ? [partnerPerson] : []), ...childPeople],
  };

  // --- Minimal expense lines from "spending"
  // Keep it simple: one annual expense line + one-off events.
  const expenses: ExpenseLine[] = [
    {
      id: "exp_core",
      label: "Lebenshaltungskosten (gesamt)",
      amountToday: d.spending.annualSpendingToday,
      frequency: "annual",
      startYearOffset: 0,
      indexation: d.spending.indexation,
      extraGrowth: d.spending.extraGrowth,
    },
       ...d.spending.oneOffEvents.map((e): ExpenseLine => ({
      id: e.id,
      label: e.label,
      amountToday: e.amount,
      frequency: "one_time",
      startYearOffset: e.yearOffset,
      indexation: "fixed_real" as const,
    })),
    ...d.spending.adjustments.map((adj) => spendingAdjToExpenseLines(d, baseYear, adj)), // NEW
  ];

  // --- Incomes (other incomes)
  const incomes: IncomeLine[] = d.futureIncome.otherIncomes;

  // --- Pensions
  const pensions = [
    { personId: d.household.self.id, sources: d.futureIncome.selfPensions.map(pensionDraftToSource) },
  ];
  if (partnerPerson) {
    pensions.push({ personId: partnerPerson.id, sources: d.futureIncome.partnerPensions.map(pensionDraftToSource) });
  }

  // --- Assets from wealth buckets (simple)
  const assets: Asset[] = [
    { id: "asset_liquid", label: "Liquid", bucket: "liquid", marketValueToday: d.wealth.liquid },
    { id: "asset_invested", label: "Investiert", bucket: "invested", marketValueToday: d.wealth.invested },
    { id: "asset_tied", label: "Gebunden (Vorsorge)", bucket: "tied_pension", marketValueToday: d.wealth.tiedPension, lockedUntilAge: 60 },
    { id: "asset_re", label: "Immobilien", bucket: "real_estate", marketValueToday: d.wealth.realEstate },
  ];

  const out: Model1Input = {
    baseYear,
    household,
    assumptions: d.assumptions as Assumptions,
    expenses,
    incomes,
    pensions,
    assets,
    debts: d.wealth.debts,
    emergencyReserveToday: d.wealth.emergencyReserveToday,
  };

  return { ok: true, value: out, issues: [] };
}

// Convenience: extract children ages for later tax logic
export function getChildrenAgesAtYear(household: Household, year: number): Array<{ personId: string; label: string; age: number }> {
  return household.members
    .filter((m) => m.role === "child" && typeof m.birthYear === "number")
    .map((m) => ({ personId: m.id, label: m.label, age: ageAtYear(m.birthYear as number, year) }));
}

// map PensionDraft -> PensionSource (existing type) so the rest of Model1Input stays stable
function pensionDraftToSource(p: PensionDraft): PensionSource {
  return {
    id: p.id,
    label: p.label,
    type:
      p.label === "AHV" ? "AHV" :
      p.label === "PK" ? "PK" :
      p.label === "3a" ? "Pillar3a" : "Other",
    taxable: p.taxable,

    ...(p.taxCategory ? { taxCategory: p.taxCategory } : {}),

    annuityAnnual: p.mode === "annuity" ? (p.annuityAnnual ?? 0) : undefined,
    annuityStartAge: p.startsAtAge,
    annuityIndexation: "inflation",

    capitalAtStartAge: p.mode === "capital" ? (p.capitalAmount ?? 0) : undefined,
    capitalStartAge: p.startsAtAge,
  };
}


// spending adjustments -> expense lines as +/- deltas starting at age
// v1: we express as annual line that starts at yearOffset derived from self current age.
function spendingAdjToExpenseLines(
  d: Model1DraftState,
  baseYear: number,
  adj: SpendingAdjustmentDraft
): ExpenseLine {
  const selfAge = baseYear - d.household.self.birthYear;
  const yearOffset = Math.max(0, adj.startsAtAge - selfAge);

  return {
    id: adj.id,
    label: `Anpassung: ${adj.label}`,
    amountToday: adj.annualDelta,
    frequency: "annual",
    startYearOffset: yearOffset,
    indexation: "fixed_real",
  };
}