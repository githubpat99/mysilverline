"use client";

import { useMemo, useRef } from "react";
import type { Step3Data, AssetPosition, DebtPosition } from "@/lib/types";
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

type AccountOption = {
  key: string; // "asset:id" | "debt:id" | "liquidity" (Fallback)
  label: string;
  bucket: Destination;
};

function makeKey(kind: "asset" | "debt", id: string) {
  return `${kind}:${id}`;
}

function accountKeyToBucket(
  key: string,
  assets: AssetPosition[],
  debts: DebtPosition[]
): Destination {
  if (key === "liquidity") return "liquidity";
  if (key.startsWith("asset:")) {
    const id = key.slice(6);
    const p = assets.find((a) => a.id === id);
    if (!p) return "liquidity";
    const av = p.availability ?? "instant";
    if (av === "instant") return "liquidity";
    if (av === "3m_3y") return "short";
    if (av === "gt_3y") return "long";
    if (av === "locked") return "long";
    return "liquidity";
  }
  if (key.startsWith("debt:")) return "debt";
  return "liquidity";
}

function buildDestOptions(assets: AssetPosition[]): AccountOption[] {
  const opts: AccountOption[] = assets.map((p) => {
    const key = makeKey("asset", p.id);
    const bucket = accountKeyToBucket(key, assets, []);
    return {
      key,
      label: (p.label || "").trim() || `Aktiv (${p.id})`,
      bucket,
    };
  });
  if (opts.length === 0) {
    opts.push({ key: "liquidity", label: "Liquidität", bucket: "liquidity" });
  }
  return opts;
}

function buildSrcOptions(assets: AssetPosition[], debts: DebtPosition[]): AccountOption[] {
  const opts: AccountOption[] = [];
  for (const p of assets) {
    opts.push({
      key: makeKey("asset", p.id),
      label: (p.label || "").trim() || `Aktiv (${p.id})`,
      bucket: accountKeyToBucket(makeKey("asset", p.id), assets, debts),
    });
  }
  for (const p of debts) {
    opts.push({
      key: makeKey("debt", p.id),
      label: (p.label || "").trim() || `Schuld (${p.id})`,
      bucket: "debt",
    });
  }
  if (opts.length === 0) {
    opts.push({ key: "liquidity", label: "Liquidität", bucket: "liquidity" });
  }
  return opts;
}

type Props = {
  value: Step3Data;
  onChange: (next: Step3Data) => void;

  annualsOpen: null | "income" | "expense";
  onAnnualsOpenChange: (v: null | "income" | "expense") => void;

  eventOpenId: string | null;
  onEventOpenIdChange: (id: string | null) => void;

  assets?: AssetPosition[];
  debts?: DebtPosition[];

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
  assets = [],
  debts = [],
  onCommit,
}: Props) {
  const destOptions = useMemo(() => buildDestOptions(assets), [assets]);
  const srcOptions = useMemo(() => buildSrcOptions(assets, debts), [assets, debts]);

  function resolveDestLabel(keyOrBucket: string | undefined): string {
    if (!keyOrBucket) return "Liquidität";
    const opt = destOptions.find((o) => o.key === keyOrBucket);
    if (opt) return opt.label;
    const byBucket = destOptions.find((o) => o.bucket === keyOrBucket);
    return byBucket?.label ?? "Liquidität";
  }

  function resolveSrcLabel(keyOrBucket: string | undefined): string {
    if (!keyOrBucket) return "Liquidität";
    const opt = srcOptions.find((o) => o.key === keyOrBucket);
    if (opt) return opt.label;
    const byBucket = srcOptions.find((o) => o.bucket === keyOrBucket);
    return byBucket?.label ?? "Liquidität";
  }

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

    const keyA = f.fundingSources?.[0]?.sourceAccountKey ?? (f.fundingSources?.[0]?.source === "liquidity" ? "liquidity" : null) ?? "liquidity";
    const keyB = f.fundingSources?.[1]?.sourceAccountKey ?? (f.fundingSources?.[1]?.source === "short" ? srcOptions.find((o) => o.bucket === "short")?.key : null) ?? srcOptions[1]?.key ?? "liquidity";

    const selA = srcOptions.find((o) => o.key === keyA)?.key ?? srcOptions[0]?.key ?? "liquidity";
    const selB = srcOptions.find((o) => o.key === keyB)?.key ?? srcOptions[1]?.key ?? srcOptions[0]?.key ?? "liquidity";

    const shareA = String(f.fundingSources?.[0]?.share ?? 0.7);
    const shareB = String(f.fundingSources?.[1]?.share ?? 0.3);

    function commitFunding(patch: Partial<typeof f> & any) {
      const merged: any = { ...f, ...patch };

      const aShare = clamp01(parseNum(merged._shareA ?? shareA));
      const bShare = clamp01(parseNum(merged._shareB ?? shareB));

      const key1 = merged._srcA ?? selA;
      const key2 = merged._srcB ?? selB;
      const opt1 = srcOptions.find((o) => o.key === key1) ?? srcOptions[0];
      const opt2 = srcOptions.find((o) => o.key === key2) ?? srcOptions[1] ?? srcOptions[0];

      const sources =
        merged.fundingStrategy === "fixedSplit"
          ? [
              { source: (opt1?.bucket ?? "liquidity") as FundingSource, share: aShare, sourceAccountKey: key1 === "liquidity" ? undefined : key1 },
              { source: (opt2?.bucket ?? "short") as FundingSource, share: bShare, sourceAccountKey: key2 === "liquidity" ? undefined : key2 },
            ]
          : [
              { source: (opt1?.bucket ?? "liquidity") as FundingSource, sourceAccountKey: key1 === "liquidity" ? undefined : key1 },
              { source: (opt2?.bucket ?? "short") as FundingSource, sourceAccountKey: key2 === "liquidity" ? undefined : key2 },
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
        <div className="text-xs font-semibold text-slate-200">Quellen (Ausgabe) – Konten aus Aktiven und Passiven</div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Finanzierungsstrategie</label>
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
                value={selA}
                onChange={(ev) => commitFunding({ _srcA: ev.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
              >
                {srcOptions.map((o) => (
                  <option key={o.key} value={o.key}>
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
                value={selB}
                onChange={(ev) => commitFunding({ _srcB: ev.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
              >
                {srcOptions.map((o) => (
                  <option key={o.key} value={o.key}>
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
    const destKey = e.line.destinationAccountKey ?? (e.line.destination === "liquidity" ? "liquidity" : null) ?? "liquidity";
    const curOpt = destOptions.find((o) => o.key === destKey) ?? destOptions[0];
    const selKey = curOpt?.key ?? destKey;

    function onDestChange(key: string) {
      const opt = destOptions.find((o) => o.key === key);
      updateEventLine(e.client_id, {
        destination: (opt?.bucket ?? "liquidity") as Destination,
        destinationAccountKey: key === "liquidity" ? undefined : key,
        funding: undefined,
      });
    }

    return (
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="text-xs font-semibold text-slate-200">Ziel (Einnahme)</div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-slate-400">Ziel (Konto aus Aktiven)</label>
          <select
            value={selKey}
            onChange={(ev) => onDestChange(ev.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
          >
            {destOptions.map((o) => (
              <option key={o.key} value={o.key}>
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

  function annualIncomeDestKey(): string {
    const inc = value.annualsV2?.income?.[0] as any;
    return inc?.destinationAccountKey ?? (inc?.destination === "liquidity" ? "liquidity" : destOptions.find((o) => o.bucket === (inc?.destination ?? "liquidity"))?.key ?? "liquidity");
  }

  function setAnnualIncome(amountCHF: number, destKey: string) {
    const opt = destOptions.find((o) => o.key === destKey);
    const nextIncome: any = {
      id: "ai_total",
      label: "Annual Income Total",
      amountCHF: Math.trunc(amountCHF),
      destination: (opt?.bucket ?? "liquidity") as Destination,
      destinationAccountKey: destKey === "liquidity" ? undefined : destKey,
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
            <div className="text-sm font-semibold text-slate-100">Regelmässig</div>
            <div className="mt-1 text-xs text-slate-500">Einkommen → Destination. Ausgaben → Funding.</div>
          </div>

          {(() => {
            const income = annualIncomeAmount();
            const expense = Math.trunc(annualExpenseModel().amountCHF ?? 0);
            const diff = income - expense;
            const cls = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-slate-400";
            const sign = diff > 0 ? "+" : "";
            return (
              <div className={`text-sm font-medium tabular-nums ${cls}`}>
                {sign}{diff.toLocaleString("de-CH")} CHF
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
            </div>

            <div className="mt-3 text-2xl font-bold text-slate-100">
              {annualIncomeAmount().toLocaleString("de-CH")} CHF
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Ziel: <span className="text-slate-200">{resolveDestLabel(annualIncomeDestKey())}</span>
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
            </div>

            <div className="mt-3 text-2xl font-bold text-slate-100">
              {Math.trunc(annualExpenseModel().amountCHF ?? 0).toLocaleString("de-CH")} CHF
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Quellen:{" "}
              <span className="text-slate-200">
                {(annualExpenseModel().fundingSources ?? [{ source: "liquidity" }])
                  .map((s: any) => resolveSrcLabel(s.sourceAccountKey ?? s.source))
                  .join(", ")}
              </span>
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
            <div className="mt-1 text-xs text-slate-500">Einnahmen → Ziel. Ausgaben → Quellen.</div>
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
              const destKey = e.line?.destinationAccountKey ?? (e.line?.destination ?? "liquidity");
              const destLabel = resolveDestLabel(destKey);
              const srcs = e.line?.funding?.fundingSources ?? [{ source: "liquidity" as FundingSource }];
              const quellenLabel = srcs
                .map((s) => resolveSrcLabel(s.sourceAccountKey ?? s.source))
                .join(", ");
              const routing = isIncome ? `Ziel: ${destLabel}` : `Quellen: ${quellenLabel}`;

              return (
                <div key={e.client_id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onEventOpenIdChange(e.client_id)}
                      className="min-w-0 flex-1 text-left hover:opacity-90"
                    >
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
                    </button>

                    <div className="flex shrink-0 items-center gap-3" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        type="button"
                        className="text-xs text-slate-200 underline decoration-slate-600 underline-offset-4"
                        onClick={() => cloneEvent(e.client_id)}
                      >
                        Dupl.
                      </button>

                      <button
                        type="button"
                        className="text-xs text-slate-300 underline decoration-slate-600 underline-offset-4"
                        onClick={() => deleteEvent(e.client_id)}
                      >
                        Entfernen
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
                    Regelmässig: {annualsOpen === "income" ? "Jahreseinkommen" : "Jahresausgaben"}
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
                        onChange={(n: number) => setAnnualIncome(Math.trunc(n), annualIncomeDestKey())}
                        suffix="CHF"
                        size="short"
                      />

                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Ziel (Konto aus Aktiven)</label>
                        <select
                          value={annualIncomeDestKey()}
                          onChange={(ev) => setAnnualIncome(annualIncomeAmount(), ev.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                        >
                          {destOptions.map((o) => (
                            <option key={o.key} value={o.key}>
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
                    const keyA = ex0.fundingSources?.[0]?.sourceAccountKey ?? (ex0.fundingSources?.[0]?.source === "liquidity" ? "liquidity" : null) ?? "liquidity";
                    const keyB = ex0.fundingSources?.[1]?.sourceAccountKey ?? srcOptions.find((o) => o.bucket === (ex0.fundingSources?.[1]?.source ?? "short"))?.key ?? srcOptions[1]?.key ?? "liquidity";

                    const selA = srcOptions.find((o) => o.key === keyA)?.key ?? srcOptions[0]?.key ?? "liquidity";
                    const selB = srcOptions.find((o) => o.key === keyB)?.key ?? srcOptions[1]?.key ?? srcOptions[0]?.key ?? "liquidity";

                    const shareA = String(ex0.fundingSources?.[0]?.share ?? 0.7);
                    const shareB = String(ex0.fundingSources?.[1]?.share ?? 0.3);

                    function commitExpense(patch: Partial<any>) {
                      const merged = { ...ex0, ...patch };

                      const aShare = clamp01(parseNum(merged._shareA ?? shareA));
                      const bShare = clamp01(parseNum(merged._shareB ?? shareB));

                      const key1 = merged._srcA ?? selA;
                      const key2 = merged._srcB ?? selB;
                      const opt1 = srcOptions.find((o) => o.key === key1) ?? srcOptions[0];
                      const opt2 = srcOptions.find((o) => o.key === key2) ?? srcOptions[1] ?? srcOptions[0];

                      const fundingSources =
                        merged.fundingStrategy === "fixedSplit"
                          ? [
                              { source: (opt1?.bucket ?? "liquidity") as FundingSource, share: aShare, sourceAccountKey: key1 === "liquidity" ? undefined : key1 },
                              { source: (opt2?.bucket ?? "short") as FundingSource, share: bShare, sourceAccountKey: key2 === "liquidity" ? undefined : key2 },
                            ]
                          : [
                              { source: (opt1?.bucket ?? "liquidity") as FundingSource, sourceAccountKey: key1 === "liquidity" ? undefined : key1 },
                              { source: (opt2?.bucket ?? "short") as FundingSource, sourceAccountKey: key2 === "liquidity" ? undefined : key2 },
                            ];

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
                            <label className="mb-1 block text-xs text-slate-400">Finanzierungsstrategie</label>
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
                            <label className="mb-1 block text-xs text-slate-400">Quelle 1 (Konto)</label>
                            <select
                              value={selA}
                              onChange={(ev) => commitExpense({ _srcA: ev.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                            >
                              {srcOptions.map((o) => (
                                <option key={o.key} value={o.key}>
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
                            <label className="mb-1 block text-xs text-slate-400">Quelle 2 (Konto)</label>
                            <select
                              value={selB}
                              onChange={(ev) => commitExpense({ _srcB: ev.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                            >
                              {srcOptions.map((o) => (
                                <option key={o.key} value={o.key}>
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

                        </div>
                      </div>
                    );
                  })()
                )}

                <div className="mt-3 text-xs text-slate-500">
                  Hinweis: Regelmässige Beträge sind “Total”-Werte. Detaillierung (optional) kommt später.
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
                    {openEvent.line?.line_type === "income" ? "Einnahme → Ziel" : "Ausgabe → Quellen"}
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
                    <div className="text-xs text-slate-500">Pflichtfelder: Einnahme → Ziel. Ausgabe → Quellen. Standard: Liquidität.</div>

                    <button
                      type="button"
                      onClick={() => deleteEvent(openEvent.client_id)}
                      className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-200 hover:border-slate-600"
                    >
                      Entfernen
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
