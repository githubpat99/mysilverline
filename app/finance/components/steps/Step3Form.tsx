"use client";

import { useMemo, useRef } from "react";
import type { Step3Data } from "@/lib/types";
import MoneyInput from "@/app/lotto/components/MoneyInput";

import type { AnnualsV2 } from "@/lib/types/v2/annualsV2";
import { AnnualsV2Schema } from "@/lib/validation/v2/annualsV2.schema";

import type {
  ProfileEvent,
  EventRecurrence,
  EventLineType,
  EventIndexation,
  Destination,
  FundingSource,
  FundingStrategy,
} from "@/lib/types/v2/events";

type Props = {
  value: Step3Data;
  onChange: (next: Step3Data) => void;

  annualsOpen: null | "income" | "expense";
  onAnnualsOpenChange: (v: null | "income" | "expense") => void;

  eventOpenId: string | null;
  onEventOpenIdChange: (id: string | null) => void;

  // autosave hook (wie Step1/2)
  onCommit?: () => void | Promise<void>;
};

const EVENT_RECURRENCE_OPTIONS: Array<{ value: EventRecurrence; label: string }> = [
  { value: "none", label: "einmalig (Startjahr)" },
  { value: "yearly", label: "jährlich" },
  { value: "monthly", label: "monatlich" },
];

const EVENT_TYPE_OPTIONS: Array<{ value: EventLineType; label: string }> = [
  { value: "income", label: "Einnahme" },
  { value: "spending", label: "Ausgabe" },
];

const EVENT_INDEXATION_OPTIONS: Array<{ value: EventIndexation | "none"; label: string }> = [
  { value: "none", label: "keine" },
  { value: "inflation", label: "mit Inflation" },
  { value: "fixed_real", label: "real konstant" },
  { value: "fixed_nominal", label: "nominal fix" },
];

const DEST_OPTIONS: Array<{ value: Destination; label: string }> = [
  { value: "liquidity", label: "Liquidität" },
  { value: "short", label: "Short" },
  { value: "long", label: "Long" },
  { value: "debt", label: "Schulden (Tilgung)" },
];

const SRC_OPTIONS: Array<{ value: FundingSource; label: string }> = [
  { value: "liquidity", label: "Liquidität" },
  { value: "short", label: "Short" },
  { value: "long", label: "Long" },
  { value: "debt", label: "Schulden (neuer Kredit)" },
];

const STRATEGY_OPTIONS: Array<{ value: FundingStrategy; label: string }> = [
  { value: "waterfall", label: "Waterfall" },
  { value: "fixedSplit", label: "Fixed Split" },
];

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseNum(s: string): number {
  return Number(String(s || "0").replace(/[’'\s]/g, "").replace(",", ".")) || 0;
}

function ymd(year: number, month: number, day: number) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function currentYear(): number {
  return new Date().getFullYear();
}

function makeClientId() {
  return `ui:event:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function makeEmptyEvent(): ProfileEvent {
  const y = currentYear();
  return {
    client_id: makeClientId(),
    title: "Neues Ereignis",
    start_date: ymd(y, 1, 1),
    end_date: null,
    recurrence: "none",
    active: 1,
    meta_json: { notes: "" },
    line: {
      line_type: "income",
      amount_chf: 0,
      indexation: null,
      category: null,
      meta_json: null,
      destination: "liquidity",
    },
  };
}

function ensureSpendingFunding(e: ProfileEvent): ProfileEvent {
  const funding =
    e.line.funding ?? {
      fundingStrategy: "waterfall" as FundingStrategy,
      fundingSources: [{ source: "liquidity" as FundingSource }, { source: "short" as FundingSource }],
      minLiquidityCHF: 10000,
      allowLoanAsLastResort: true,
    };

  return {
    ...e,
    line: {
      ...e.line,
      funding,
      destination: undefined,
    },
  };
}

function ensureIncomeDestination(e: ProfileEvent): ProfileEvent {
  const dest: Destination = (e.line.destination ?? "liquidity") as Destination;
  return {
    ...e,
    line: {
      ...e.line,
      destination: dest,
      funding: undefined,
    },
  };
}

function formatYearRange(e: ProfileEvent) {
  const s = e.start_date?.slice(0, 4) ?? "—";
  const t = e.end_date ? e.end_date.slice(0, 4) : "offen";
  return `${s}–${t}`;
}

export default function Step3Form({
  value,
  onChange,
  annualsOpen,
  onAnnualsOpenChange,
  eventOpenId,
  onEventOpenIdChange,
  onCommit,
}: Props) {
  // ---------------- autosave: dirty + lock ----------------
  const dirtyRef = useRef(false);
  const committingRef = useRef(false);

  function markDirty() {
    dirtyRef.current = true;
  }

  async function commitIfDirty() {
    if (!onCommit) return;
    if (!dirtyRef.current) return;

    dirtyRef.current = false;

    if (committingRef.current) return;
    committingRef.current = true;
    try {
      await onCommit();
    } finally {
      committingRef.current = false;
    }
  }

  // ---------------- Annuals helpers ----------------
  function setAnnualsV2(next: AnnualsV2) {
    markDirty();
    onChange({ ...value, annualsV2: next });
  }

  // ---------------- Events helpers ----------------
  const events: ProfileEvent[] = (value.events ?? []) as ProfileEvent[];

  function setEvents(next: ProfileEvent[]) {
    markDirty();
    onChange({ ...value, events: next });
  }

  function addEvent() {
    const e = makeEmptyEvent();
    setEvents([...(events ?? []), e]);
    onEventOpenIdChange(e.client_id); // direkt öffnen
  }

  function deleteEvent(client_id: string) {
    const next = (events ?? []).filter((e) => e.client_id !== client_id);
    setEvents(next);
    if (eventOpenId === client_id) onEventOpenIdChange(null);
  }

  function updateEvent(client_id: string, patch: Partial<ProfileEvent>) {
    setEvents((events ?? []).map((e) => (e.client_id === client_id ? { ...e, ...patch } : e)));
  }

  function updateEventLine(client_id: string, patch: Partial<ProfileEvent["line"]>) {
    setEvents(
      (events ?? []).map((e) =>
        e.client_id === client_id ? { ...e, line: { ...e.line, ...patch } } : e,
      ),
    );
  }

  function cloneEvent(client_id: string) {
    const src = (events ?? []).find((e) => e.client_id === client_id);
    if (!src) return;
    const copy: ProfileEvent = {
      ...src,
      id: undefined,
      client_id: makeClientId(),
      title: `${src.title} (Kopie)`,
    };
    setEvents([...(events ?? []), copy]);
    onEventOpenIdChange(copy.client_id);
  }

  function onChangeEventType(client_id: string, nextType: EventLineType) {
    setEvents(
      (events ?? []).map((e) => {
        if (e.client_id !== client_id) return e;
        const updated: ProfileEvent = { ...e, line: { ...e.line, line_type: nextType } };
        return nextType === "spending" ? ensureSpendingFunding(updated) : ensureIncomeDestination(updated);
      }),
    );
  }

  // --- Funding editor (used inside event modal) ---
  function renderFundingEditor(e: ProfileEvent) {
    const f =
      e.line.funding ?? {
        fundingStrategy: "waterfall" as FundingStrategy,
        fundingSources: [{ source: "liquidity" as FundingSource }, { source: "short" as FundingSource }],
        minLiquidityCHF: 10000,
        allowLoanAsLastResort: true,
      };

    const strategy: FundingStrategy = f.fundingStrategy ?? "waterfall";

    const srcA: FundingSource = (f.fundingSources?.[0]?.source ?? "liquidity") as FundingSource;
    const srcB: FundingSource = (f.fundingSources?.[1]?.source ?? "short") as FundingSource;

    const shareA = String(f.fundingSources?.[0]?.share ?? 0.7);
    const shareB = String(f.fundingSources?.[1]?.share ?? 0.3);

    function commitFunding(patch: Partial<typeof f> & any) {
      const merged: any = { ...f, ...patch };

      const aShare = clamp01(parseNum(merged._shareA ?? shareA));
      const bShare = clamp01(parseNum(merged._shareB ?? shareB));

      const sources =
        merged.fundingStrategy === "fixedSplit"
          ? [
              { source: (merged._srcA ?? srcA) as FundingSource, share: aShare },
              { source: (merged._srcB ?? srcB) as FundingSource, share: bShare },
            ]
          : [
              { source: (merged._srcA ?? srcA) as FundingSource },
              { source: (merged._srcB ?? srcB) as FundingSource },
            ];

      const nextFunding = {
        fundingStrategy: (merged.fundingStrategy ?? "waterfall") as FundingStrategy,
        fundingSources: sources,
        minLiquidityCHF:
          merged.minLiquidityCHF === "" || merged.minLiquidityCHF === undefined
            ? undefined
            : Math.trunc(Number(merged.minLiquidityCHF) || 0),
        allowLoanAsLastResort: !!merged.allowLoanAsLastResort,
      };

      updateEventLine(e.client_id, { funding: nextFunding, destination: undefined });
    }

    return (
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="text-xs font-semibold text-slate-200">Funding (Ausgabe)</div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Funding Strategy</label>
            <select
              value={strategy}
              onChange={(ev) => commitFunding({ fundingStrategy: ev.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
            >
              {STRATEGY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Quelle 1</label>
              <select
                value={srcA}
                onChange={(ev) => commitFunding({ _srcA: ev.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
              >
                {SRC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {strategy === "fixedSplit" && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs text-slate-400">Share 1 (0..1)</label>
                  <input
                    value={shareA}
                    onChange={(ev) => commitFunding({ _shareA: ev.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Quelle 2</label>
              <select
                value={srcB}
                onChange={(ev) => commitFunding({ _srcB: ev.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
              >
                {SRC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {strategy === "fixedSplit" && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs text-slate-400">Share 2 (0..1)</label>
                  <input
                    value={shareB}
                    onChange={(ev) => commitFunding({ _shareB: ev.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">minLiquidityCHF (optional)</label>
            <input
              value={String(f.minLiquidityCHF ?? "")}
              onChange={(ev) => commitFunding({ minLiquidityCHF: ev.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
              placeholder="z.B. 10000"
            />
          </div>

          <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={!!f.allowLoanAsLastResort}
              onChange={(ev) => commitFunding({ allowLoanAsLastResort: ev.target.checked })}
            />
            Kredit als letzte Quelle erlauben
          </label>
        </div>
      </div>
    );
  }

  function renderDestinationEditor(e: ProfileEvent) {
    const dest = (e.line.destination ?? "liquidity") as Destination;

    return (
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="text-xs font-semibold text-slate-200">Destination (Einnahme)</div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-slate-400">Destination</label>
          <select
            value={dest}
            onChange={(ev) =>
              updateEventLine(e.client_id, {
                destination: ev.target.value as Destination,
                funding: undefined,
              })
            }
            className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
          >
            {DEST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // ---------------- Annuals editor builders (modal content) ----------------
  function annualIncomeAmount() {
    return Math.trunc(value.annualsV2?.income?.[0]?.amountCHF ?? 0);
  }

  function annualIncomeDest(): Destination {
    return ((value.annualsV2?.income?.[0] as any)?.destination ?? "liquidity") as Destination;
  }

  function setAnnualIncome(amountCHF: number, destination: Destination) {
    const nextIncome: any = {
      id: "ai_total",
      label: "Annual Income Total",
      amountCHF: Math.trunc(amountCHF),
      destination,
    };
    const next: AnnualsV2 = {
      income: [nextIncome],
      expense: value.annualsV2?.expense ?? [],
    };
    setAnnualsV2(next);
  }

  function annualExpenseModel(): any {
    return (
      value.annualsV2?.expense?.[0] ?? {
        id: "ae_total",
        label: "Annual Expense Total",
        amountCHF: 0,
        fundingStrategy: "waterfall",
        fundingSources: [{ source: "liquidity" }, { source: "short" }],
        minLiquidityCHF: 10000,
      }
    );
  }

  function setAnnualExpense(nextExpense: any) {
    const next: AnnualsV2 = {
      income: value.annualsV2?.income ?? [],
      expense: [nextExpense],
    };
    setAnnualsV2(next);
  }

  // ---------------- Event modal selection ----------------
  const openEvent = eventOpenId ? (events ?? []).find((e) => e.client_id === eventOpenId) : null;

  function closeAnnualsModal() {
    void commitIfDirty();
    onAnnualsOpenChange(null);
  }

  function closeEventModal() {
    void commitIfDirty();
    onEventOpenIdChange(null);
  }

  return (
    // global blur: wenn Fokus komplett aus Step3 rausgeht -> speichern
    <div
      className="space-y-6"
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        void commitIfDirty();
      }}
    >
      {/* Annuals: compact tiles */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">Annuals</div>
            <div className="mt-1 text-xs text-slate-500">Einkommen → Destination. Ausgaben → Funding.</div>
          </div>

          {(() => {
            const r = AnnualsV2Schema.safeParse(value.annualsV2);
            return (
              <div className="text-xs">
                {r.success ? (
                  <span className="text-emerald-300">valid</span>
                ) : (
                  <span className="text-rose-300">invalid</span>
                )}
              </div>
            );
          })()}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onAnnualsOpenChange("income")}
            className="text-left rounded-2xl border border-slate-800 bg-slate-950/40 p-5 hover:border-slate-700"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Jahreseinkommen</div>
                <div className="text-xs text-slate-400">Total (CHF/Jahr)</div>
              </div>
              <span className="text-xs rounded-full border border-slate-700 px-2 py-1 text-slate-200">bearbeiten</span>
            </div>

            <div className="mt-3 text-2xl font-bold text-slate-100">
              {annualIncomeAmount().toLocaleString("de-CH")} CHF
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Destination: <span className="text-slate-200">{annualIncomeDest()}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onAnnualsOpenChange("expense")}
            className="text-left rounded-2xl border border-slate-800 bg-slate-950/40 p-5 hover:border-slate-700"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Jahresausgaben</div>
                <div className="text-xs text-slate-400">Total (CHF/Jahr)</div>
              </div>
              <span className="text-xs rounded-full border border-slate-700 px-2 py-1 text-slate-200">bearbeiten</span>
            </div>

            <div className="mt-3 text-2xl font-bold text-slate-100">
              {Math.trunc(annualExpenseModel().amountCHF ?? 0).toLocaleString("de-CH")} CHF
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Strategy: <span className="text-slate-200">{annualExpenseModel().fundingStrategy ?? "waterfall"}</span>
            </div>
          </button>
        </div>
      </div>

      <div className="h-px w-full bg-slate-800/70" />

      {/* Events: compact list */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Ereignisse</div>
            <div className="mt-1 text-xs text-slate-500">Einnahmen → Destination. Ausgaben → Funding.</div>
          </div>

          <button
            type="button"
            onClick={addEvent}
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900"
          >
            + Ereignis
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {events.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
              Keine Ereignisse erfasst.
            </div>
          ) : (
            events.map((e) => {
              const isIncome = (e.line?.line_type ?? "income") === "income";
              const amount = Math.trunc(e.line?.amount_chf ?? 0);
              const routing = isIncome
                ? `→ ${((e.line?.destination ?? "liquidity") as any) as string}`
                : `Funding: ${((e.line?.funding?.fundingStrategy ?? "waterfall") as any) as string}`;

              return (
                <div key={e.client_id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs rounded-full border border-slate-700 px-2 py-0.5 text-slate-200">
                          {isIncome ? "Einnahme" : "Ausgabe"}
                        </span>
                        <div className="truncate text-sm font-medium text-slate-100">{e.title || "—"}</div>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{amount.toLocaleString("de-CH")} CHF</span>
                        <span>·</span>
                        <span>{formatYearRange(e)}</span>
                        <span>·</span>
                        <span>{e.recurrence ?? "none"}</span>
                        <span>·</span>
                        <span className="text-slate-300">{routing}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onEventOpenIdChange(e.client_id)}
                        className="rounded-full border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-600"
                      >
                        Bearbeiten
                      </button>

                      <button
                        type="button"
                        className="text-xs text-slate-200 underline decoration-slate-600 underline-offset-4"
                        onClick={() => cloneEvent(e.client_id)}
                      >
                        Dupl.
                      </button>

                      <button
                        type="button"
                        className="text-xs text-red-300 underline decoration-red-700/60 underline-offset-4"
                        onClick={() => deleteEvent(e.client_id)}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------- Annuals Modal ---------------- */}
      {annualsOpen && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={closeAnnualsModal} aria-label="Close" />

          <div className="absolute inset-x-0 top-6 mx-auto w-[calc(100%-2rem)] max-w-4xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                <div>
                  <div className="font-semibold text-slate-100">
                    Annuals: {annualsOpen === "income" ? "Jahreseinkommen" : "Jahresausgaben"}
                  </div>
                  <div className="text-sm text-slate-400">
                    {annualsOpen === "income"
                      ? "Einnahmen benötigen eine Destination."
                      : "Ausgaben benötigen Funding (Strategy + Quellen)."}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeAnnualsModal}
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-600"
                >
                  Schliessen
                </button>
              </div>

              <div className="p-5">
                {annualsOpen === "income" ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-semibold text-slate-100">Jahreseinkommen (Total)</div>

                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <MoneyInput
                        label="Betrag (CHF/Jahr)"
                        value={annualIncomeAmount()}
                        onChange={(n: number) => setAnnualIncome(Math.trunc(n), annualIncomeDest())}
                        suffix="CHF"
                        size="short"
                      />

                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Destination</label>
                        <select
                          value={annualIncomeDest()}
                          onChange={(ev) => setAnnualIncome(annualIncomeAmount(), ev.target.value as Destination)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                        >
                          {DEST_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const ex0: any = annualExpenseModel();

                    const strategy: FundingStrategy = ex0.fundingStrategy ?? "waterfall";
                    const srcA: FundingSource = ex0.fundingSources?.[0]?.source ?? "liquidity";
                    const srcB: FundingSource = ex0.fundingSources?.[1]?.source ?? "short";

                    const shareA = String(ex0.fundingSources?.[0]?.share ?? 0.7);
                    const shareB = String(ex0.fundingSources?.[1]?.share ?? 0.3);

                    function commitExpense(patch: Partial<any>) {
                      const merged = { ...ex0, ...patch };

                      const aShare = clamp01(parseNum(merged._shareA ?? shareA));
                      const bShare = clamp01(parseNum(merged._shareB ?? shareB));

                      const fundingSources =
                        merged.fundingStrategy === "fixedSplit"
                          ? [
                              { source: merged._srcA ?? srcA, share: aShare },
                              { source: merged._srcB ?? srcB, share: bShare },
                            ]
                          : [{ source: merged._srcA ?? srcA }, { source: merged._srcB ?? srcB }];

                      const nextExpense = {
                        id: "ae_total",
                        label: "Annual Expense Total",
                        amountCHF: Math.trunc(merged.amountCHF ?? 0),
                        fundingStrategy: merged.fundingStrategy ?? "waterfall",
                        fundingSources,
                        minLiquidityCHF:
                          merged.minLiquidityCHF === "" || merged.minLiquidityCHF === undefined
                            ? undefined
                            : Math.trunc(Number(merged.minLiquidityCHF) || 0),
                      };

                      setAnnualExpense(nextExpense);
                    }

                    return (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="text-sm font-semibold text-slate-100">Jahresausgaben (Total)</div>

                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <MoneyInput
                            label="Betrag (CHF/Jahr)"
                            value={Math.trunc(ex0.amountCHF ?? 0)}
                            onChange={(n: number) => commitExpense({ amountCHF: Math.trunc(n) })}
                            suffix="CHF"
                            size="short"
                          />

                          <div>
                            <label className="mb-1 block text-xs text-slate-400">Funding Strategy</label>
                            <select
                              value={strategy}
                              onChange={(ev) => commitExpense({ fundingStrategy: ev.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                            >
                              {STRATEGY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-slate-400">Quelle 1</label>
                            <select
                              value={srcA}
                              onChange={(ev) => commitExpense({ _srcA: ev.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                            >
                              {SRC_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>

                            {strategy === "fixedSplit" && (
                              <div className="mt-2">
                                <label className="mb-1 block text-xs text-slate-400">Share 1 (0..1)</label>
                                <input
                                  value={shareA}
                                  onChange={(ev) => commitExpense({ _shareA: ev.target.value })}
                                  className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-slate-400">Quelle 2</label>
                            <select
                              value={srcB}
                              onChange={(ev) => commitExpense({ _srcB: ev.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                            >
                              {SRC_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>

                            {strategy === "fixedSplit" && (
                              <div className="mt-2">
                                <label className="mb-1 block text-xs text-slate-400">Share 2 (0..1)</label>
                                <input
                                  value={shareB}
                                  onChange={(ev) => commitExpense({ _shareB: ev.target.value })}
                                  className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                                />
                              </div>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs text-slate-400">minLiquidityCHF (optional)</label>
                            <input
                              value={String(ex0.minLiquidityCHF ?? "")}
                              onChange={(ev) => commitExpense({ minLiquidityCHF: ev.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                              placeholder="z.B. 10000"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}

                <div className="mt-3 text-xs text-slate-500">
                  Hinweis: Annuals sind “Total”-Werte. Detaillierung (optional) kommt später.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Event Modal ---------------- */}
      {openEvent && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={closeEventModal} aria-label="Close" />

          <div className="absolute inset-x-0 top-6 mx-auto w-[calc(100%-2rem)] max-w-5xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100">Ereignis bearbeiten</div>
                  <div className="text-sm text-slate-400">
                    {openEvent.line?.line_type === "income" ? "Einnahme → Destination" : "Ausgabe → Funding"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cloneEvent(openEvent.client_id)}
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-600"
                  >
                    Duplizieren
                  </button>
                  <button
                    type="button"
                    onClick={closeEventModal}
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-600"
                  >
                    Schliessen
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-slate-400">Titel</label>
                    <input
                      value={openEvent.title ?? ""}
                      onChange={(ev) => updateEvent(openEvent.client_id, { title: ev.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                      placeholder="Titel"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Typ</label>
                    <select
                      value={openEvent.line?.line_type ?? "income"}
                      onChange={(ev) => onChangeEventType(openEvent.client_id, ev.target.value as EventLineType)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    >
                      {EVENT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <MoneyInput
                    label="Betrag (CHF)"
                    value={Math.trunc(openEvent.line?.amount_chf ?? 0)}
                    onChange={(n: number) => updateEventLine(openEvent.client_id, { amount_chf: Math.trunc(n) })}
                    suffix="CHF"
                    size="short"
                  />

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Startdatum</label>
                    <input
                      type="date"
                      value={openEvent.start_date ?? ""}
                      onChange={(ev) => updateEvent(openEvent.client_id, { start_date: ev.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Enddatum (optional)</label>
                    <input
                      type="date"
                      value={openEvent.end_date ?? ""}
                      onChange={(ev) => updateEvent(openEvent.client_id, { end_date: ev.target.value || null })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    />
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => updateEvent(openEvent.client_id, { end_date: null })}
                        className="text-xs text-slate-300 underline decoration-slate-600 underline-offset-4"
                      >
                        Enddatum leeren (offen)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Wiederholung</label>
                    <select
                      value={openEvent.recurrence ?? "none"}
                      onChange={(ev) => updateEvent(openEvent.client_id, { recurrence: ev.target.value as EventRecurrence })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    >
                      {EVENT_RECURRENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Indexierung (Event)</label>
                    <select
                      value={((openEvent.line?.indexation ?? "none") as any)}
                      onChange={(ev) =>
                        updateEventLine(openEvent.client_id, {
                          indexation: ev.target.value === "none" ? null : (ev.target.value as EventIndexation),
                        })
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    >
                      {EVENT_INDEXATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    {openEvent.line?.line_type === "income" ? renderDestinationEditor(openEvent) : renderFundingEditor(openEvent)}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-slate-400">Notizen (optional)</label>
                    <textarea
                      value={(openEvent.meta_json?.notes ?? "") as string}
                      onChange={(ev) =>
                        updateEvent(openEvent.client_id, {
                          meta_json: { ...(openEvent.meta_json ?? {}), notes: ev.target.value },
                        })
                      }
                      rows={3}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                      placeholder="z.B. Autokauf 2027, Renovation, Erbschaft, Bonus, ..."
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-500">Pflichtfelder: Einnahme → Destination. Ausgabe → Funding.</div>

                    <button
                      type="button"
                      onClick={() => deleteEvent(openEvent.client_id)}
                      className="rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200 hover:border-red-800"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
