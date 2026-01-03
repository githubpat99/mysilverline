// =======================
// file: src/lib/lotto/types.ts
// =======================

export type DateISO = `${number}-${number}-${number}`; // "YYYY-MM-DD" best-effort
export type Currency = "CHF" | "EUR" | "USD";
export type Frequency = "one_time" | "annual";
export type TaxMode = "simple_effective" | "none";

export type RelationshipRole = "self" | "partner" | "child";

export type Assumptions = {
  currency: Currency;

  returnMode: "real" | "nominal";
  realReturn?: number; // e.g. 0.025
  nominalReturn?: number; // e.g. 0.04
  inflation?: number; // e.g. 0.01

  annualFees?: number; // e.g. 0.003
  taxMode: TaxMode;

  effectiveIncomeTaxRate?: number; // e.g. 0.12
  wealthTaxRate?: number; // e.g. 0.003
};

export type Person = {
  id: string;
  role: RelationshipRole;
  label: string;

  birthDate?: DateISO; // preferred for children
  birthYear?: number; // ok for adults if you don't want exact date

  inHousehold: boolean;
  dependent?: boolean;

  retireAtAge?: number;

  planToAge?: number;
  extraSafetyYears?: number;
};

export type Household = {
  members: Person[]; // dynamic list: self, optional partner, 0..n children
};

export type ExpenseLine = {
  id: string;
  label: string;
  amountToday: number;
  frequency: Frequency;
  startYearOffset?: number; // 0 = this year
  endYearOffset?: number; // inclusive
  indexation: "inflation" | "fixed_nominal" | "fixed_real";
  extraGrowth?: number; // additional growth on top of inflation
};

export type IncomeLine = {
  id: string;
  label: string;
  amountTodayOrAtStart: number;
  frequency: "annual";
  startYearOffset: number;
  endYearOffset?: number;
  indexation: "inflation" | "fixed_nominal" | "fixed_real";
  extraGrowth?: number;
  taxable: boolean;
  taxCategory?: PensionSource["taxCategory"];
};

export type PensionSource = {
  id: string;
  label: string;
  type: "AHV" | "PK" | "Pillar3a" | "Other";

  annuityAnnual?: number; // in today's money
  annuityStartAge?: number;
  annuityIndexation?: "inflation" | "fixed_nominal" | "fixed_real";

  capitalAtStartAge?: number; // in today's money
  capitalStartAge?: number;

  taxable: boolean;
  taxCategory?: "pension" | "rental" | "other";
};

export type Asset = {
  id: string;
  label: string;
  bucket: "liquid" | "invested" | "tied_pension" | "real_estate" | "other";
  marketValueToday: number;
  lockedUntilAge?: number;
};

export type Debt = {
  id: string;
  label: string;
  principalToday: number;
  annualInterestRate: number;
  repayMode: "interest_only" | "amortize_linear" | "amortize_fixed_payment";
  amortizeYears?: number;
  annualPayment?: number;
  payoffImmediately?: boolean;
};

export type Model1Input = {
  baseYear: number;
  household: Household;

  assumptions: Assumptions;
  expenses: ExpenseLine[];
  incomes: IncomeLine[];

  pensions: Array<{ personId: string; sources: PensionSource[] }>;

  assets: Asset[];
  debts: Debt[];

  emergencyReserveToday?: number;
};

// --------------------
// UI draft state types
// --------------------

export type ChildDraft = {
  id: string;
  label: string;
  birthDate: DateISO; // REQUIRED
  inHousehold: boolean;
  dependent: boolean;
};

export type PartnerDraft = {
  enabled: boolean;
  id: string;
  label: string;
  birthYear?: number;
  birthDate?: DateISO;
  retireAtAge?: number;
  inHousehold: boolean;
};

// ==================================
// PATCH: lib/lotto/types.ts
// Add these types + extend Model1DraftState
// ==================================

export type AmountMode = "annual"; // keep v1 simple

export type PensionMode = "annuity" | "capital";

export type PersonRef = "self" | "partner";

export type PensionDraft = {
  id: string;
  label: string; // e.g. "AHV", "PK", "3a"
  mode: PensionMode;

  // start trigger
  startsAtAge: number;

  // annuity
  annuityAnnual?: number; // CHF/year (today's money)

  // capital (one-off)
  capitalAmount?: number; // CHF (today's money)

  // taxable in v1 (used later)
  taxable: boolean;
  taxCategory?: PensionSource["taxCategory"];
};

export type SpendingAdjustmentDraft = {
  id: string;
  label: string;
  startsAtAge: number; // intuitive
  annualDelta: number; // +/- CHF per year in today's money
};

export type RetirementPlanDraft = {
  retireNow: boolean;
  retireAtAge: number; // keep always set (default 65)
  planToAge: number;
  extraSafetyYears: number;
};

// ---- Extend Model1DraftState ----
// Replace household.self retire fields with RetirementPlanDraft (or keep and add partnerPlan)
// Minimal invasive: add partnerPlan + spendingAdjustments + pensionsByPerson.

export type Model1DraftState = {
  household: {
    self: {
      id: string;
      label: string;
      birthYear: number;
      inHousehold: true;

      // keep existing fields but ensure retireAtAge default is set
      retireNow: boolean;
      retireAtAge: number;
      planToAge: number;
      extraSafetyYears: number;
    };

    partner: PartnerDraft & {
      // new: partner plan horizon
      retireNow?: boolean;
      retireAtAge?: number; // will default to 65 when enabled
      planToAge?: number;   // default 95 when enabled
      extraSafetyYears?: number;
    };

    children: ChildDraft[];
  };

  spending: {
    annualSpendingToday: number;
    indexation: "inflation" | "fixed_nominal" | "fixed_real";
    extraGrowth: number;

    oneOffEvents: Array<{ id: string; label: string; amount: number; yearOffset: number }>;

    // NEW:
    adjustments: SpendingAdjustmentDraft[];
  };

  futureIncome: {
    // replace/augment pensions arrays with structured drafts per person
    selfPensions: PensionDraft[];
    partnerPensions: PensionDraft[];
    otherIncomes: IncomeLine[];
  };

  wealth: {
    liquid: number;
    invested: number;
    tiedPension: number;
    realEstate: number;
    debts: Debt[];
    emergencyReserveToday: number;

    // NEW (optional): separate tied pension share for partner if you want
    partnerTiedPension?: number;
  };

  assumptions: Assumptions;
};


// --------------------
// Validation structures
// --------------------

export type ValidationIssue = {
  path: string; // e.g. "household.children[0].birthDate"
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };
