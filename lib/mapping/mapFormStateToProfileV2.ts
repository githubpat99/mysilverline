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
import type { Year } from "@/lib/types/v2/annualsV2";

import type { AssetClass, FormState, Availability } from "@/lib/types";


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

function normalizeAvailability(a: any): Availability {
  if (a === "instant") return "instant";
  if (a === "3m_3y") return "3m_3y";
  if (a === "locked") return "locked";
  // treat locked as gt_3y if it ever comes in
  return "gt_3y";
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

  // ---- INSTRUMENTS --- mapping via mapping/positions/formStateToDtos.ts

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

      // IMPORTANT: explicitly keep destination/funding + account keys
      const line: any = {
        ...rawLine,
        amount_chf: Math.trunc(rawLine.amount_chf ?? 0),
        indexation: rawLine.indexation ?? null,
        category: rawLine.category ?? null,
        meta_json: rawLine.meta_json ?? null,
        destination: rawLine.destination ?? undefined,
        funding: rawLine.funding ?? undefined,
        destinationAccountKey: rawLine.destinationAccountKey ?? undefined,
      };
      if (line.funding?.fundingSources) {
        line.funding = {
          ...line.funding,
          fundingSources: line.funding.fundingSources.map((s: any) => ({
            ...s,
            sourceAccountKey: s.sourceAccountKey ?? undefined,
          })),
        };
      }

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
