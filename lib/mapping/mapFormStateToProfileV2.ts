// lib/mapping/mapFormStateToProfileV2.ts

import type { FormState } from "@/lib/types";
import type { ProfileV2, Person, Instrument, AnnualItem } from "@/lib/types/v2";
import type { Event as ProfileEventV2 } from "@/lib/types/v2/events";

import type { Money, Year } from "@/lib/types/v2/money";

// ---------- helpers ----------
function upsertAnnualItem(list: AnnualItem[], next: AnnualItem): AnnualItem[] {
  const idx = list.findIndex((x) => x.id === next.id);
  if (idx >= 0) {
    const copy = list.slice();
    copy[idx] = next;
    return copy;
  }
  return [...list, next];
}

function removeAnnualItem(list: AnnualItem[], id: string): AnnualItem[] {
  return list.filter((x) => x.id !== id);
}

function deepClone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

// "YYYY-MM-DD" → YYYY
function yearFromISO(dateISO: string): number {
  const y = Number(dateISO.slice(0, 4));
  return Number.isFinite(y) ? y : 0;
}

// Parses "3'500", "3500", "3 500" to number (Money)
// If you later want cents: change Money type + parser accordingly.
function parseMoney(input: unknown): Money {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return 0;

  const s = input
    .trim()
    .replace(/[’']/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, "."); // tolerate comma decimals

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function upsertInstrument(list: Instrument[], next: Instrument): Instrument[] {
  const idx = list.findIndex((i) => i.id === next.id);
  if (idx >= 0) {
    const copy = list.slice();
    copy[idx] = next;
    return copy;
  }
  return [...list, next];
}

function removeInstrument(list: Instrument[], id: string): Instrument[] {
  return list.filter((i) => i.id !== id);
}

function upsertEvent(list: ProfileEventV2[], next: ProfileEventV2): ProfileEventV2[] {
  const idx = list.findIndex((e) => e.client_id === next.client_id);
  if (idx >= 0) {
    const copy = list.slice();
    copy[idx] = next;
    return copy;
  }
  return [...list, next];
}

function removeEvent(
  list: ProfileEventV2[],
  client_id: string
): ProfileEventV2[] {
  return list.filter((e) => e.client_id !== client_id);
}

function isZeroish(n: number) {
  return !n || Math.abs(n) < 1e-9;
}

function ensureSelfPerson(persons: Person[]): { persons: Person[]; index: number } {
  const idx = persons.findIndex((p) => p.role === "self");
  if (idx >= 0) return { persons, index: idx };

  const self: Person = {
    id: "self",
    role: "self",
    birthDate: "1980-01-01",
    retireAtAge: 65,
  };

  return { persons: [self, ...persons], index: 0 };
}

// Stable UI ids to prevent duplicates
const UI = {
  // assets (step1)
  cash: "ui:asset:cash",
  bank: "ui:asset:bank",
  securities: "ui:asset:securities",
  otherAsset: "ui:asset:other",

  // debts (step2)
  mortgage: "ui:debt:mortgage",
  consumer: "ui:debt:consumer",
  creditcard: "ui:debt:creditcard",
  otherShort: "ui:debt:otherShort",
  loan: "ui:debt:loan",
  otherLong: "ui:debt:otherLong",
  otherDebt: "ui:debt:otherDebt_sum",
} as const;

// stable numeric ids for "quick" UI events (must not collide with DB auto-increment ids)
// We use negative ids for UI-only items.
export const UI_EVT = {
  futureIncome: "ui:event:future_income",
  futureExpense: "ui:event:future_expense",
} as const;

export type UiEventId = (typeof UI_EVT)[keyof typeof UI_EVT];



// ---------- main ----------
export function mapFormStateToProfileV2(form: FormState, prev: ProfileV2): ProfileV2 {
  const next = deepClone(prev);

  // ---- SELF (household.persons[role=self]) ----
  const basePersons = next.household?.persons ?? [];
  const { persons, index } = ensureSelfPerson(basePersons);
  const self = { ...persons[index] };

  const birthDate = form.step1?.birthDate;
  if (birthDate && birthDate.length === 10) {
    const y = yearFromISO(birthDate);
    if (y >= 1900 && y <= 2200) self.birthDate = birthDate;
  }

  const raaRaw = (form.step1 as any)?.retireAtAge;
  const raa = typeof raaRaw === "number" ? raaRaw : Number(String(raaRaw ?? "").trim());
  self.retireAtAge = Number.isFinite(raa) && raa > 0 ? raa : 65;

  const nextPersons = persons.slice();
  nextPersons[index] = self;
  next.household = { ...next.household, persons: nextPersons };

  // ---- INSTRUMENTS ----
  let instruments: Instrument[] = next.instruments ?? [];

  // Step 1 – Assets
  const cash = parseMoney(form.step1?.cash);
  instruments = isZeroish(cash)
    ? removeInstrument(instruments, UI.cash)
    : upsertInstrument(instruments, {
      id: UI.cash,
      kind: "asset",
      assetType: "cash",
      label: "Bargeld",
      value: cash,
    });

  const bank = parseMoney(form.step1?.bankSavings);
  instruments = isZeroish(bank)
    ? removeInstrument(instruments, UI.bank)
    : upsertInstrument(instruments, {
      id: UI.bank,
      kind: "asset",
      assetType: "bank",
      label: "Bank",
      value: bank,
    });

  const securities = parseMoney(form.step1?.securities);
  instruments = isZeroish(securities)
    ? removeInstrument(instruments, UI.securities)
    : upsertInstrument(instruments, {
      id: UI.securities,
      kind: "asset",
      assetType: "securities",
      label: "Wertpapiere",
      value: securities,
    });

  const otherAsset = parseMoney(form.step1?.otherInvest);
  instruments = isZeroish(otherAsset)
    ? removeInstrument(instruments, UI.otherAsset)
    : upsertInstrument(instruments, {
      id: UI.otherAsset,
      kind: "asset",
      assetType: "other",
      label: "Investitionen",
      value: otherAsset,
    });

  // Step 2 – Debts
  const mortgage = parseMoney(form.step2?.mortgage);
  instruments = isZeroish(mortgage)
    ? removeInstrument(instruments, UI.mortgage)
    : upsertInstrument(instruments, {
      id: UI.mortgage,
      kind: "debt",
      debtType: "mortgage",
      label: "Hypothek",
      balance: mortgage,
    });

  const consumer = parseMoney(form.step2?.consumerLoan);
  instruments = isZeroish(consumer)
    ? removeInstrument(instruments, UI.consumer)
    : upsertInstrument(instruments, {
      id: UI.consumer,
      kind: "debt",
      debtType: "consumer",
      label: "Konsumkredit",
      balance: consumer,
    });

  const creditcard = parseMoney(form.step2?.creditCard);
  instruments = isZeroish(creditcard)
    ? removeInstrument(instruments, UI.creditcard)
    : upsertInstrument(instruments, {
      id: UI.creditcard,
      kind: "debt",
      debtType: "creditcard",
      label: "Kreditkarte",
      balance: creditcard,
    });

  // Other kurzfristig
  const otherShort = parseMoney(form.step2?.otherShort);
  instruments = isZeroish(otherShort)
    ? removeInstrument(instruments, UI.otherShort)
    : upsertInstrument(instruments, {
      id: UI.otherShort,
      kind: "debt",
      debtType: "other_short",
      label: "Weitere kurzfristige",
      balance: otherShort,
    });

  // Darlehen
  const loan = parseMoney(form.step2?.loan);
  instruments = isZeroish(loan)
    ? removeInstrument(instruments, UI.loan)
    : upsertInstrument(instruments, {
      id: UI.loan,
      kind: "debt",
      debtType: "loan",
      label: "Darlehen",
      balance: loan,
    });

  // Other langfristig
  const otherLong = parseMoney(form.step2?.otherLong);
  instruments = isZeroish(otherLong)
    ? removeInstrument(instruments, UI.otherLong)
    : upsertInstrument(instruments, {
      id: UI.otherLong,
      kind: "debt",
      debtType: "other_long",
      label: "Weitere langfristige",
      balance: otherLong,
    });

  // (Optional) Altes Summen-Instrument entfernen, falls es noch existiert:
  instruments = removeInstrument(instruments, UI.otherDebt);

  next.instruments = instruments;

  type AnnualIndexation = "inflation" | "fixed_real" | "fixed_nominal";

  const baseYear = (next.meta?.startYear ?? new Date().getFullYear()) as Year;

  // startYear kannst du in meta lassen (ok), aber Indexation NICHT.
  next.meta = { ...(next.meta ?? {}), startYear: baseYear };

  const idxRaw = (form.step3?.indexation ?? "").trim() as AnnualIndexation | "";
  const prevIdx = (next.annuals?.indexation ?? "inflation") as AnnualIndexation;

  // IMPORTANT: nur überschreiben, wenn UI gesetzt ist, sonst bestehenden Wert behalten
  const indexation = (idxRaw || prevIdx) as AnnualIndexation;

  const incomeToday = parseMoney(form.step3?.annualIncomeToday);
  const needToday = parseMoney(form.step3?.annualSpendingToday);

  const AN = {
    incomeToday: "ui:annual:income_today",
    needToday: "ui:annual:need_today",
  } as const;

  let income = next.annuals?.income ?? [];
  let need = next.annuals?.need ?? [];

  if (isZeroish(incomeToday)) income = removeAnnualItem(income, AN.incomeToday);
  else income = upsertAnnualItem(income, { id: AN.incomeToday, label: "Jahreseinkommen heute (UI)", amount: incomeToday, startYear: baseYear });

  if (isZeroish(needToday)) need = removeAnnualItem(need, AN.needToday);
  else need = upsertAnnualItem(need, { id: AN.needToday, label: "Jahresbedarf heute (UI)", amount: needToday, startYear: baseYear });

  // MERGE statt platt machen
  next.annuals = {
    ...(next.annuals ?? {}),
    indexation,
    income,
    need,
  };

  // ---- EVENTS (Step 3 cards -> take 1:1, no legacy mapping) ----
  // Small hardening: normalize + keep only valid-ish items without "over-hardening"
  const stepEvents = (form.step3?.events ?? []) as ProfileEventV2[];

  const normalizedEvents: ProfileEventV2[] = stepEvents
    .filter((e) => !!e && typeof e.client_id === "string" && e.client_id.trim().length > 0)
    .map((e) => {
      const title = (e.title ?? "").trim() || "Ereignis";

      // keep ISO date strings as provided; end_date may be null
      const start_date = e.start_date;
      const end_date = e.end_date ?? null;

      // keep your recurrence set
      const recurrence = e.recurrence ?? "none";

      // active default = 1
      const active = (e.active ?? 1) as 0 | 1;

      // preserve meta_json (important: don't wipe notes)
      const meta_json = e.meta_json ?? null;

      // line: enforce whole CHF and preserve meta_json
      const line = {
        ...e.line,
        amount_chf: Math.trunc(e.line?.amount_chf ?? 0),
        indexation: e.line?.indexation ?? null,
        category: e.line?.category ?? null,
        meta_json: e.line?.meta_json ?? null,
      };

      return {
        ...e,
        title,
        start_date,
        end_date,
        recurrence,
        active,
        meta_json,
        line,
      };
    });

  // Replace profile events with step3 events (since you said no important data yet)
  next.events = normalizedEvents;

  return next;
}
