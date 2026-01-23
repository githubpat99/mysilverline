// app/finance/components/steps/Step1Form.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import type { FormState, AssetPosition, DebtPosition, Availability, AssetClass, Goal } from "@/lib/types";
import { Amount, InlineAmount } from "../Amount";
import { FieldMoneyInt } from "../fields/FieldMoney";
import { bucketFromAvailability, type Bucket } from "@/lib/forecast/buckets";

type Step1Data = FormState["step1"];

// Minimal ForecastRow shape for header CF (avoid importing forecast types here)
type ForecastRowLike = {
  assetCashflowToLiq?: number;
  assetCashflowReinvest?: number;
};

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

function makeId() {
  return "pos_" + Math.random().toString(36).slice(2, 10);
}

const BUCKET_META: Record<Bucket, { title: string; subtitle: string; pill: string }> = {
  LIQ: { title: "Liquidität", subtitle: "Sicherheit", pill: "sofort" },
  ST: { title: "Kurzfristige Anlagen", subtitle: "Parkieren", pill: "3M–3J" },
  LT: { title: "Langfristige Anlagen", subtitle: "Wachstum", pill: "> 3 Jahre" },
  REAL: { title: "Sachwerte", subtitle: "Substanz", pill: "gebunden" },
};

function bucketToAvailability(b: Bucket): Availability {
  return b === "LIQ" ? "instant" : b === "ST" ? "3m_3y" : b === "LT" ? "gt_3y" : "locked";
}

/**
 * Gegenkonto-Regeln (targetAccountKey):
 * - NIE auf sich selber.
 * - goal="liq": Gegenkonto muss LIQ-Asset sein.
 * - goal="reinvest": Gegenkonto muss Nicht-LIQ-Asset sein.
 * - Wenn kein Cashflow: Gegenkonto nicht erzwingen.
 */

type AccountOption = {
  key: string; // "asset:<id>" | "debt:<id>"
  label: string;
  bucket: Bucket;
  kind: "asset" | "debt";
  id: string;
};

function makeKey(kind: "asset" | "debt", id: string) {
  return `${kind}:${id}`;
}

function isValidKey(key: string | undefined, opts: AccountOption[]) {
  if (!key) return false;
  return opts.some((o) => o.key === key);
}

function findFirstAssetKey(opts: AccountOption[], pred: (o: AccountOption) => boolean) {
  return opts.find((o) => o.kind === "asset" && pred(o))?.key;
}

function isAssetKey(key: string) {
  return key.startsWith("asset:");
}

function keyId(key: string) {
  const i = key.indexOf(":");
  return i >= 0 ? key.slice(i + 1) : key;
}

export default function Step1Form({
  value,
  onChange,
  activeBucket,
  onActiveBucketChange,
  onCommit, // <- SAVE trigger vom Parent
  rows, // <- Forecast rows (optional), for header CF
  debts = [], // <- neu: damit Gegenkonto auch Passiven zeigen kann (optional, aber sinnvoll)
}: {
  value: Step1Data;
  onChange: (next: Step1Data) => void;
  activeBucket: Bucket;
  onActiveBucketChange: (b: Bucket) => void;
  onCommit?: () => void | Promise<void>;
  rows?: ForecastRowLike[];
  debts?: DebtPosition[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // "dirty per position id"
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const committingRef = useRef(false);

  // IMPORTANT: use canonical form field "targetAccountKey" (camelCase) stored in FormState
  const positions: AssetPosition[] = (value.positions ?? []) as any;

  const grouped = useMemo(() => {
    const g: Record<Bucket, AssetPosition[]> = { LIQ: [], ST: [], LT: [], REAL: [] };
    for (const p of positions) g[bucketFromAvailability(p.availability)].push(p);
    return g;
  }, [positions]);

  const accountOptions: AccountOption[] = useMemo(() => {
    const a: AccountOption[] = positions.map((p) => {
      const b = bucketFromAvailability(p.availability);
      return {
        key: makeKey("asset", p.id),
        label: p.label?.trim() ? p.label : `Aktiv (${b})`,
        bucket: b,
        kind: "asset",
        id: p.id,
      };
    });

    const d: AccountOption[] = (debts ?? []).map((x) => {
      const b = bucketFromAvailability(x.availability);
      const label = x.label?.trim() ? x.label : `Schuld (${b})`;
      return {
        key: makeKey("debt", x.id),
        label: `Schuld: ${label}`,
        bucket: b,
        kind: "debt",
        id: x.id,
      };
    });

    const order: Record<Bucket, number> = { LIQ: 0, ST: 1, LT: 2, REAL: 3 };
    return [...a, ...d].sort((x, y) => order[x.bucket] - order[y.bucket] || x.label.localeCompare(y.label));
  }, [positions, debts]);

  const defaultLiqAssetKey = useMemo(() => {
    return findFirstAssetKey(accountOptions, (o) => o.bucket === "LIQ");
  }, [accountOptions]);

  const defaultNonLiqAssetKey = useMemo(() => {
    return findFirstAssetKey(accountOptions, (o) => o.bucket !== "LIQ");
  }, [accountOptions]);

  const bucketTotals = (b: Bucket) => {
    const ps = grouped[b];
    return {
      totalValue: sum(ps.map((p) => p.amountChf)),
      cashflowLiq: sum(ps.filter((p) => p.goal === "liq").map((p) => p.cashflowPa)),
      cashflowReinvest: sum(ps.filter((p) => p.goal === "reinvest").map((p) => p.cashflowPa)),
      positions: ps.length,
    };
  };

  const totals = useMemo(() => {
    return {
      allValue: sum(positions.map((p) => p.amountChf)),
      allCashflowToLiq: sum(positions.filter((p) => p.goal === "liq").map((p) => p.cashflowPa)),
      LIQ: bucketTotals("LIQ"),
      ST: bucketTotals("ST"),
      LT: bucketTotals("LT"),
      REAL: bucketTotals("REAL"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, grouped]);

  function setPositions(next: AssetPosition[]) {
    onChange({ ...value, positions: next as any });
  }

  function markDirty(id: string) {
    dirtyIdsRef.current.add(id);
  }

  async function commitIfDirty(id?: string) {
    if (!onCommit) return;

    if (typeof id === "string") {
      if (!dirtyIdsRef.current.has(id)) return;
      dirtyIdsRef.current.delete(id);
    } else {
      if (dirtyIdsRef.current.size === 0) return;
      dirtyIdsRef.current.clear();
    }

    // Save-lock gegen parallele Saves (mobile taps, blur-flurry)
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      await onCommit();
    } finally {
      committingRef.current = false;
    }
  }

  function ensureCounterAccount(p: AssetPosition): AssetPosition {
    // Wenn kein Cashflow: Gegenkonto nicht erzwingen
    const hasCf = typeof p.cashflowPa === "number" && Math.abs(p.cashflowPa) > 0;
    if (!hasCf) return p;

    const selfKey = makeKey("asset", p.id);

    // nie auf sich selbst
    const isSelf = p.targetAccountKey === selfKey;
    let nextKey = isSelf ? undefined : p.targetAccountKey ?? undefined;

    if (p.goal === "liq") {
      // muss LIQ-Asset existieren
      if (!defaultLiqAssetKey) return { ...p, targetAccountKey: undefined };

      // Gegenkonto muss LIQ-Asset sein
      const ok =
        typeof nextKey === "string" &&
        isValidKey(nextKey, accountOptions) &&
        isAssetKey(nextKey) &&
        (() => {
          const id = keyId(nextKey);
          const opt = accountOptions.find((o) => o.kind === "asset" && o.id === id);
          return opt?.bucket === "LIQ";
        })() &&
        nextKey !== selfKey;

      if (!ok) {
        // default: erstes LIQ-Asset, aber nicht self
        const candidate = accountOptions.find((o) => o.kind === "asset" && o.bucket === "LIQ" && o.key !== selfKey)?.key;
        return { ...p, targetAccountKey: candidate };
      }

      return { ...p, targetAccountKey: nextKey };
    }

    // goal === "reinvest"
    if (!defaultNonLiqAssetKey) return { ...p, targetAccountKey: undefined };

    const ok =
      typeof nextKey === "string" &&
      isValidKey(nextKey, accountOptions) &&
      isAssetKey(nextKey) &&
      (() => {
        const id = keyId(nextKey);
        const opt = accountOptions.find((o) => o.kind === "asset" && o.id === id);
        return opt?.bucket !== "LIQ";
      })() &&
      nextKey !== selfKey;

    if (!ok) {
      const candidate = accountOptions.find((o) => o.kind === "asset" && o.bucket !== "LIQ" && o.key !== selfKey)?.key;
      return { ...p, targetAccountKey: candidate };
    }

    return { ...p, targetAccountKey: nextKey };
  }

  function upsert(id: string, patch: Partial<AssetPosition>) {
    markDirty(id);
    const next = positions.map((p) => {
      if (p.id !== id) return p;
      const merged = { ...p, ...patch };
      return ensureCounterAccount(merged);
    });
    setPositions(next);
  }

  function addPosition(intoBucket: Bucket) {
    const next: AssetPosition = ensureCounterAccount({
      id: makeId(),
      label: "Neue Position",
      amountChf: 0,
      currency: "CHF",
      availability: bucketToAvailability(intoBucket),
      assetClass: "other",
      cashflowPa: 0,
      goal: "liq",
      notes: "",
      targetAccountKey: undefined,
      sourceAccountKey: undefined,
    } as any);

    markDirty(next.id);
    setPositions([...positions, next]);
  }

  function removePosition(id: string) {
    markDirty(id);
    setPositions(positions.filter((p) => p.id !== id));
  }

  const activeItems = grouped[activeBucket];

  function openDetails(bucket: Bucket) {
    onActiveBucketChange(bucket);
    setIsModalOpen(true);
  }

  function closeModal() {
    void commitIfDirty();
    setIsModalOpen(false);
  }

  // Prefer forecast-derived CF if available, else UI-derived sum
  const r0 = rows?.[0];
  const cfToLiq = (typeof r0?.assetCashflowToLiq === "number" ? r0.assetCashflowToLiq : totals.allCashflowToLiq) ?? 0;

  const missingPrereqs = useMemo(() => {
    const hasLiqAsset = !!defaultLiqAssetKey;
    const hasNonLiqAsset = !!defaultNonLiqAssetKey;
    return { hasLiqAsset, hasNonLiqAsset };
  }, [defaultLiqAssetKey, defaultNonLiqAssetKey]);

  function counterOptionsFor(p: AssetPosition) {
    const selfKey = makeKey("asset", p.id);

    if (p.goal === "liq") {
      // nur LIQ-Assets
      return accountOptions.filter((o) => o.kind === "asset" && o.bucket === "LIQ" && o.key !== selfKey);
    }
    // reinvest: nur Nicht-LIQ-Assets
    return accountOptions.filter((o) => o.kind === "asset" && o.bucket !== "LIQ" && o.key !== selfKey);
  }

  function counterError(p: AssetPosition) {
    const hasCf = typeof p.cashflowPa === "number" && Math.abs(p.cashflowPa) > 0;
    if (!hasCf) return "";

    const opts = counterOptionsFor(p);
    if (p.goal === "liq" && opts.length === 0) return "Für Ziel=liq brauchst du mindestens ein LIQ-Konto bei Aktiven.";
    if (p.goal === "reinvest" && opts.length === 0) return "Für Ziel=reinvest brauchst du mindestens ein Nicht-LIQ-Konto bei Aktiven.";

    const selfKey = makeKey("asset", p.id);
    if (!p.targetAccountKey) return "Gegenkonto fehlt.";
    if (p.targetAccountKey === selfKey) return "Gegenkonto darf nicht die gleiche Position sein.";
    if (!opts.some((o) => o.key === p.targetAccountKey)) return "Gegenkonto ist ungültig (falscher Bucket/Ziel).";

    return "";
  }

  return (
    <div>
      {/* Header (ohne Kachel) */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-50">Schritt 1: Aktiven</h2>
            <p className="mt-2 text-sm text-slate-300">Abgeleitet aus Verfügbarkeit + AssetClass. Kein Bucket-Feld.</p>
          </div>

          <div className="min-w-0 text-right">
            <div className="text-xs uppercase tracking-wide text-slate-400 whitespace-normal wrap-break-word">Gesamtvermögen</div>

            <div className="mt-1">
              <Amount value={totals.allValue} size="lg" align="right" />
            </div>

            <div className="mt-2 text-sm text-slate-400">
              Cashflows p.a.:{" "}
              <span className="text-slate-200">
                <InlineAmount value={cfToLiq} />
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-800/80" />
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {(Object.keys(BUCKET_META) as Bucket[]).map((b) => {
          const meta = BUCKET_META[b];
          const t = totals[b];
          const isActive = activeBucket === b;

          return (
            <div
              key={b}
              className={[
                "rounded-2xl border p-5 transition",
                isActive ? "border-sky-500/60 bg-slate-950/60" : "border-slate-800 bg-slate-950/40 hover:border-slate-700",
              ].join(" ")}
            >
              <button type="button" onClick={() => openDetails(b)} className="block w-full text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{meta.title}</div>
                    <div className="text-xs text-slate-400">{meta.subtitle}</div>
                  </div>
                  <span className="text-xs rounded-full border border-slate-700 px-2 py-1 text-slate-200">{meta.pill}</span>
                </div>

                <div className="mt-3">
                  <Amount value={t.totalValue} size="sm" align="left" />
                </div>

                <div className="mt-3 text-sm text-slate-400 space-y-1">
                  <div>Cashflow p.a.</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">→ Liquidität</span>
                    <span className="text-slate-200">
                      <InlineAmount value={t.cashflowLiq} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">→ Reinvest</span>
                    <span className="text-slate-200">
                      <InlineAmount value={t.cashflowReinvest} />
                    </span>
                  </div>
                  <div className="pt-2 text-xs text-slate-500">Positionen: {t.positions}</div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <button type="button" className="absolute inset-0 bg-black/60" onClick={closeModal} aria-label="Close" />

          {/* panel */}
          <div className="absolute inset-x-0 top-6 mx-auto w-[calc(100%-2rem)] max-w-5xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                <div>
                  <div className="font-semibold text-slate-100">Details: {BUCKET_META[activeBucket].title}</div>
                  <div className="text-sm text-slate-400">Du steuerst Label/Wert/Verfügbarkeit/AssetClass/Cashflow/Ziel/Gegenkonto/Notiz.</div>

                  {!missingPrereqs.hasLiqAsset && (
                    <div className="mt-2 text-xs text-amber-400/90">
                      Hinweis: Kein LIQ-Aktivenkonto vorhanden. Ziel=liq kann nicht korrekt geroutet werden.
                    </div>
                  )}
                  {!missingPrereqs.hasNonLiqAsset && (
                    <div className="mt-1 text-xs text-amber-400/90">
                      Hinweis: Kein Nicht-LIQ-Aktivenkonto vorhanden. Ziel=reinvest kann nicht korrekt geroutet werden.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addPosition(activeBucket)}
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-600 whitespace-nowrap"
                    type="button"
                  >
                    + Position
                  </button>
                  <button
                    onClick={closeModal}
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-600"
                    type="button"
                  >
                    Schliessen
                  </button>
                </div>
              </div>

              <div className="p-5">
                {/* Mobile: Cards */}
                <div className="space-y-3 md:hidden">
                  {activeItems.map((p) => {
                    const err = counterError(p);

                    return (
                      <div
                        key={p.id}
                        tabIndex={-1}
                        className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                        onBlurCapture={(e) => {
                          const next = e.relatedTarget as Node | null;
                          if (next && e.currentTarget.contains(next)) return;
                          void commitIfDirty(p.id);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <input
                            value={p.label}
                            onChange={(e) => upsert(p.id, { label: e.target.value })}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => removePosition(p.id)}
                            className="shrink-0 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm hover:border-red-800"
                            type="button"
                          >
                            Löschen
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <FieldMoneyInt label="Wert" valueChf={p.amountChf} onChangeChf={(n) => upsert(p.id, { amountChf: n })} />
                          </div>

                          <div>
                            <FieldMoneyInt label="Cashflow p.a." valueChf={p.cashflowPa} onChangeChf={(n) => upsert(p.id, { cashflowPa: n })} />
                          </div>

                          <div>
                            <div className="text-xs text-slate-400 mb-1">Verfügbarkeit</div>
                            <select
                              value={p.availability}
                              onChange={(e) => upsert(p.id, { availability: e.target.value as Availability })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                            >
                              <option value="instant">sofort</option>
                              <option value="3m_3y">3M–3J</option>
                              <option value="gt_3y">&gt; 3J</option>
                              <option value="locked">gebunden</option>
                            </select>
                          </div>

                          <div>
                            <div className="text-xs text-slate-400 mb-1">AssetClass</div>
                            <select
                              value={p.assetClass}
                              onChange={(e) => upsert(p.id, { assetClass: e.target.value as AssetClass })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                            >
                              <option value="cash">cash</option>
                              <option value="bank">bank</option>
                              <option value="securities">securities</option>
                              <option value="pension">pension</option>
                              <option value="real_estate">real_estate</option>
                              <option value="gold">gold</option>
                              <option value="crypto">crypto</option>
                              <option value="p2p">p2p</option>
                              <option value="other">other</option>
                            </select>
                          </div>

                          <div>
                            <div className="text-xs text-slate-400 mb-1">Ziel</div>
                            <select
                              value={p.goal}
                              onChange={(e) => upsert(p.id, { goal: e.target.value as Goal })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                            >
                              <option value="liq">liq</option>
                              <option value="reinvest">reinvest</option>
                            </select>
                          </div>

                          <div>
                            <div className="text-xs text-slate-400 mb-1">Gegenkonto</div>
                            <select
                              value={p.targetAccountKey ?? ""}
                              onChange={(e) => upsert(p.id, { targetAccountKey: e.target.value || undefined })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                            >
                              <option value="">Gegenkonto wählen…</option>
                              {counterOptionsFor(p).map((o) => (
                                <option key={o.key} value={o.key}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            {err && <div className="mt-1 text-xs text-amber-400/90">{err}</div>}
                          </div>

                          <div>
                            <div className="text-xs text-slate-400 mb-1">Bucket</div>
                            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                              {bucketFromAvailability(p.availability)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-slate-400 mb-1">Notiz</div>
                          <input
                            value={p.notes ?? ""}
                            onChange={(e) => upsert(p.id, { notes: e.target.value })}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                            placeholder="optional"
                          />
                        </div>
                      </div>
                    );
                  })}

                  {activeItems.length === 0 && <div className="py-6 text-center text-slate-500">Keine Positionen in diesem Bucket.</div>}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-2 px-3 w-[15%]">Bezeichnung</th>
                        <th className="text-left py-2 px-3 w-[15%]">Typ</th>
                        <th className="text-left py-2 px-3 w-[12%]">Wert</th>
                        <th className="text-left py-2 px-3 w-[8%]">Bucket</th>
                        <th className="text-left py-2 px-3 w-[12%]">Cashflow</th>
                        <th className="text-left py-2 px-3 w-[8%]">Ziel</th>
                        <th className="text-left py-2 px-3 w-[15%]">Gegenkonto</th>
                        <th className="text-left py-2 px-3 w-[15%]">Notiz</th>
                        <th className="text-right py-2 w-[10%]"> </th>
                      </tr>
                    </thead>

                    <tbody>
                      {activeItems.map((p) => {
                        const err = counterError(p);

                        return (
                          <tr
                            key={p.id}
                            className="border-b border-slate-900"
                            onBlur={(e) => {
                              const next = e.relatedTarget as Node | null;
                              if (next && e.currentTarget.contains(next)) return;
                              void commitIfDirty(p.id);
                            }}
                          >
                            <td className="py-2 pr-3">
                              <input
                                value={p.label}
                                onChange={(e) => upsert(p.id, { label: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                              />
                            </td>

                            <td className="py-2 pr-3">
                              <select
                                value={p.assetClass}
                                onChange={(e) => upsert(p.id, { assetClass: e.target.value as AssetClass })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                              >
                                <option value="cash">cash</option>
                                <option value="bank">bank</option>
                                <option value="securities">securities</option>
                                <option value="pension">pension</option>
                                <option value="real_estate">real_estate</option>
                                <option value="gold">gold</option>
                                <option value="crypto">crypto</option>
                                <option value="p2p">p2p</option>
                                <option value="other">other</option>
                              </select>
                            </td>

                            <td className="py-2 pr-3">
                              <FieldMoneyInt label="" valueChf={p.amountChf} onChangeChf={(n) => upsert(p.id, { amountChf: n })} />
                            </td>

                            <td className="py-2 pr-3 text-slate-300">
                              {bucketFromAvailability(p.availability)}
                            </td>

                            <td className="py-2 pr-3">
                              <FieldMoneyInt label="" valueChf={p.cashflowPa} onChangeChf={(n) => upsert(p.id, { cashflowPa: n })} />
                            </td>

                            <td className="py-2 pr-3">
                              <select
                                value={p.goal}
                                onChange={(e) => upsert(p.id, { goal: e.target.value as Goal })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                              >
                                <option value="liq">liq</option>
                                <option value="reinvest">reinvest</option>
                              </select>
                            </td>

                            <td className="py-2 pr-3 align-top">
                              <select
                                value={p.targetAccountKey ?? ""}
                                onChange={(e) => upsert(p.id, { targetAccountKey: e.target.value || undefined })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                              >
                                <option value="">Gegenkonto wählen…</option>
                                {counterOptionsFor(p).map((o) => (
                                  <option key={o.key} value={o.key}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              {err && <div className="mt-1 text-xs text-amber-400/90">{err}</div>}
                            </td>

                            <td className="py-2 pr-3">
                              <input
                                value={p.notes ?? ""}
                                onChange={(e) => upsert(p.id, { notes: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                                placeholder="optional"
                              />
                            </td>

                            <td className="py-2 text-right">
                              <button
                                onClick={() => removePosition(p.id)}
                                className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm hover:border-red-800"
                                type="button"
                              >
                                Löschen
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {activeItems.length === 0 && (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-slate-500">
                            Keine Positionen in diesem Bucket.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Regeln: Gegenkonto nie auf sich selber. Ziel=liq braucht LIQ-Aktivenkonto. Ziel=reinvest braucht Nicht-LIQ-Aktivenkonto.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
