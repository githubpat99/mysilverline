// lib/mapping/mapFormStateToProfileV2.ts
//
// Contract (current):
// - FormState holds Step1 assets as positions[] with amountChf:number + availability (without "locked" going forward)
// - FormState holds Step2 debts as positions[] with balanceChf:number + availability (instant | 3m_3y | gt_3y)
// - ProfileV2 instruments have no availability field; we encode availability via debtType variants:
//   other_short / other_long (instant + 3m_3y => other_short, gt_3y => other_long)
//
// Notes:
// - We keep your existing meta_json strategy for assets (uiId, cashflowPa, goal, notes, assetClass, availability)
// - We drop locked handling (treat as gt_3y if it appears)

import type { ProfileV2, Person } from "@/lib/types/v2";
import type { ProfileEvent as ProfileEventV2 } from "@/lib/types/v2/events";
import type { AnnualsV2 } from "@/lib/types/v2/annualsV2";
import type { Money, Year } from "@/lib/types/v2/money";

import type { AssetClass, FormState, Availability } from "@/lib/types";
import type { Instrument, DebtInstrument, DebtType as DebtTypeV2 } from "@/lib/types/v2/instruments";

import { AnnualsV2Schema } from "@/lib/validation/v2/annualsV2.schema";

// ---------- helpers ----------
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

function deepClone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

function yearFromISO(dateISO: string): number {
  const y = Number(dateISO.slice(0, 4));
  return Number.isFinite(y) ? y : 0;
}

function isZeroish(n: number) {
  return !n || Math.abs(n) < 1e-9;
}

// Money in ProfileV2 is "number" in your current codebase.
// Keep that (no object), just truncate.
function moneyFromIntCHF(n: unknown): Money {
  const x = typeof n === "number" ? n : Number(n);
  return (Number.isFinite(x) ? Math.trunc(x) : 0) as Money;
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

function normalizeAvailability(a: any): Availability {
  if (a === "instant") return "instant";
  if (a === "3m_3y") return "3m_3y";
  if (a === "locked") return "locked";
  // treat locked as gt_3y if it ever comes in
  return "gt_3y";
}

function metaForAssetPosition(p: any) {
  return {
    uiId: p.id,
    availability: normalizeAvailability(p.availability),
    cashflowPa: Math.trunc(Number(p.cashflowPa ?? 0)),
    goal: p.goal,
    notes: p.notes ?? "",
    assetClass: p.assetClass, // optional
  };
}

function assetTypeFromClass(c: AssetClass): string {
  switch (c) {
    case "cash":
      return "cash";
    case "bank":
      return "bank";
    case "securities":
      return "securities";
    case "real_estate":
      return "real_estate";
    case "gold":
      return "gold";
    case "crypto":
      return "crypto";
    case "p2p":
      return "p2p";
    case "pension":
      return "pension";
    default:
      return "other";
  }
}

// Debt mapping:
// - base types stay
// - "other" splits into other_short vs other_long based on availability
function debtTypeV2FromForm(base: any, availability: any): DebtTypeV2 {
  if (base === "mortgage") return "mortgage";
  if (base === "loan") return "loan";
  if (base === "consumer") return "consumer";
  if (base === "creditcard") return "creditcard";

  const a = normalizeAvailability(availability);
  if (a === "gt_3y") return "other_long";
  return "other_short";
}

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  const r = Math.round(x);
  if (r < lo || r > hi) return fallback;
  return r;
}

export function mapFormStateToProfileV2(form: FormState, prev: ProfileV2): ProfileV2 {
  const next = deepClone(prev);

  // ---- SELF ----
  const basePersons = next.household?.persons ?? [];
  const { persons, index } = ensureSelfPerson(basePersons);
  const self = { ...persons[index] };

  const birthDate = form.base?.birthDate;
  if (birthDate && birthDate.length === 10) {
    const y = yearFromISO(birthDate);
    if (y >= 1900 && y <= 2200) self.birthDate = birthDate;
  }

  self.retireAtAge = clampInt(form.base?.retireAtAge ?? 65, 50, 80, 65);

  const nextPersons = persons.slice();
  nextPersons[index] = self;
  next.household = { ...next.household, persons: nextPersons };

  // ---- INSTRUMENTS ----
  let instruments: Instrument[] = Array.isArray(next.instruments) ? next.instruments : [];

  // Step1 owns assets, Step2 owns debts => drop both and rebuild from form
  instruments = instruments.filter((i: any) => i?.kind !== "asset" && i?.kind !== "debt");

  // Step1 – Assets from positions[]
  const aPos = (form.step1 as any)?.positions ?? [];
  for (const p of aPos) {
    const amount = Math.trunc(Number(p.amountChf ?? 0));
    if (isZeroish(amount)) continue;

    const inst: any = {
      // IMPORTANT: keep DB id if we have one; otherwise keep UI id as fallback (until API/DB supports ui_id)
      id: String((p as any).dbId ?? p.id),

      kind: "asset",
      assetType: assetTypeFromClass(p.assetClass),
      label: String(p.label ?? "Position"),
      value: moneyFromIntCHF(amount),

      // NEW structured fields (must be persisted as columns later)
      ui_id: String(p.id),
      availability: p.availability,
      goal: p.goal,
      cashflow_pa: Math.trunc(Number((p as any).cashflowPa ?? 0)),
      asset_class: p.assetClass,

      // Notes: prefer dedicated field
      notes: typeof (p as any).notes === "string" ? (p as any).notes : "",

      // meta_json should only carry legacy/notes (optional)
      meta_json: { notes: typeof (p as any).notes === "string" ? (p as any).notes : "" },
    };

    instruments = upsertInstrument(instruments, inst);
  }

  // Step2 – Debts from positions[]
  const dPos = (form.step2 as any)?.positions ?? [];
  for (const p of dPos) {
    const bal = Math.trunc(Number(p.balanceChf ?? 0));
    if (isZeroish(bal)) continue;

    function floatOrUndef(n: unknown): number | undefined {
      const x = typeof n === "number" ? n : Number(String(n).replace(",", "."));
      return Number.isFinite(x) ? x : undefined;
    }

    function amortTypeOrDefault(v: any): "none" | "direct" | "indirect" {
      return v === "direct" || v === "indirect" || v === "none" ? v : "none";
    }

    const rate = floatOrUndef((p as any).interestRatePct);

    const amortPa = Math.trunc(Number((p as any).amortizationPaChf ?? 0));
    let amortType = amortTypeOrDefault((p as any).amortizationType);
    if (amortPa > 0 && amortType === "none") amortType = "direct";

    const inst: any = {
      id: String((p as any).dbId ?? p.id),

      kind: "debt",
      debtType: debtTypeV2FromForm(p.debtType, p.availability),
      label: String(p.label ?? "Verpflichtung"),
      balance: moneyFromIntCHF(bal),
      interestRate: rate,
      amortization:
        amortType !== "none" || amortPa > 0
          ? { type: amortType, amountAnnual: amortPa > 0 ? moneyFromIntCHF(amortPa) : undefined }
          : undefined,

      // NEW structured fields
      ui_id: String(p.id),
      availability: p.availability,

      notes: typeof (p as any).notes === "string" ? (p as any).notes : "",
      meta_json: { notes: typeof (p as any).notes === "string" ? (p as any).notes : "" },
    };

    instruments = upsertInstrument(instruments, inst);
  }

  next.instruments = instruments;

  // ---- META ----
  const baseYear = (next.meta?.startYear ?? new Date().getFullYear()) as Year;

  const forecastHorizonYears = clampInt(
    // keep your old source, but now it's in base (per your types)
    (form.base as any)?.forecastHorizonYears ?? 55,
    1,
    120,
    55
  );

  next.meta = {
    ...(next.meta ?? {}),
    startYear: baseYear,
    forecastHorizonYears,
  };

  // ---- ANNUALS V2 (Step3 -> 1:1) ----
  const stepAnnualsV2 = (form.step3 as any)?.annualsV2 as AnnualsV2 | undefined;

  if (stepAnnualsV2) {
    const candidate: AnnualsV2 = {
      income: Array.isArray(stepAnnualsV2.income) ? stepAnnualsV2.income : [],
      expense: Array.isArray(stepAnnualsV2.expense) ? stepAnnualsV2.expense : [],
    };

    const vr = AnnualsV2Schema.safeParse(candidate);
    if (!vr.success) {
      console.warn("annualsV2 invalid on save (kept)", vr.error.issues);
      next.annualsV2 = next.annualsV2 ?? { income: [], expense: [] };
    } else {
      next.annualsV2 = vr.data;
    }
  } else {
    next.annualsV2 = next.annualsV2 ?? { income: [], expense: [] };
  }

  // ---- EVENTS (Step3 -> 1:1, keep funding/destination) ----
  const stepEvents = (form.step3?.events ?? []) as ProfileEventV2[];

  const normalizedEvents: ProfileEventV2[] = stepEvents
    .filter((e) => !!e && typeof e.client_id === "string" && e.client_id.trim().length > 0)
    .map((e) => {
      const title = (e.title ?? "").trim() || "Ereignis";

      const start_date = e.start_date;
      const end_date = e.end_date ?? null;

      const recurrence = e.recurrence ?? "none";
      const active = (e.active ?? 1) as 0 | 1;
      const meta_json = e.meta_json ?? null;

      const rawLine: any = e.line ?? {};

      // IMPORTANT: explicitly keep destination/funding
      const line: any = {
        ...rawLine,
        amount_chf: Math.trunc(rawLine.amount_chf ?? 0),
        indexation: rawLine.indexation ?? null,
        category: rawLine.category ?? null,
        meta_json: rawLine.meta_json ?? null,
        destination: rawLine.destination ?? undefined,
        funding: rawLine.funding ?? undefined,
      };

      // Clean: prevent mixed models
      if (line.line_type === "income") {
        line.funding = undefined;
      } else if (line.line_type === "spending") {
        line.destination = undefined;
      }

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

  next.events = normalizedEvents;

  return next;
}
