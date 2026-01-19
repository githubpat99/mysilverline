"use client";

import { useMemo, useRef, useState } from "react";
import type { FormState, AssetPosition, Availability, AssetClass, Goal } from "@/lib/types";
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

export default function Step1Form({
  value,
  onChange,
  activeBucket,
  onActiveBucketChange,
  onCommit, // <- SAVE trigger vom Parent
  rows, // <- Forecast rows (optional), for header CF
}: {
  value: Step1Data;
  onChange: (next: Step1Data) => void;
  activeBucket: Bucket;
  onActiveBucketChange: (b: Bucket) => void;
  onCommit?: () => void | Promise<void>;
  rows?: ForecastRowLike[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // "dirty per position id"
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const committingRef = useRef(false);

  const positions = value.positions ?? [];

  const grouped = useMemo(() => {
    const g: Record<Bucket, AssetPosition[]> = { LIQ: [], ST: [], LT: [], REAL: [] };
    for (const p of positions) g[bucketFromAvailability(p.availability)].push(p);
    return g;
  }, [positions]);

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

  console.log("[S1] allCashflowToLiq", totals.allCashflowToLiq);
  console.log("[S1] positions", positions.map(p => ({ id: p.id, cf: p.cashflowPa, goal: p.goal })));


  function setPositions(next: AssetPosition[]) {
    onChange({ ...value, positions: next });
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

  function upsert(id: string, patch: Partial<AssetPosition>) {
    markDirty(id);
    setPositions(positions.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addPosition(intoBucket: Bucket) {
    const next: AssetPosition = {
      id: makeId(),
      label: "Neue Position",
      amountChf: 0,
      currency: "CHF",
      availability: bucketToAvailability(intoBucket),
      assetClass: "other",
      cashflowPa: 0,
      goal: "liq",
      notes: "",
    };
    // neue Position ist "dirty" (damit ein Blur/Close speichert)
    markDirty(next.id);
    setPositions([...positions, next]);
  }

  function removePosition(id: string) {
    // auch als Änderung werten
    markDirty(id);
    setPositions(positions.filter((p) => p.id !== id));
  }

  const activeItems = grouped[activeBucket];

  function openDetails(bucket: Bucket) {
    onActiveBucketChange(bucket);
    setIsModalOpen(true);
  }

  function closeModal() {
    // beim Schliessen alles persistieren, falls noch dirty
    void commitIfDirty();
    setIsModalOpen(false);
  }

  // Prefer forecast-derived CF if available, else UI-derived sum
  const r0 = rows?.[0];
  const cfToLiq = (typeof r0?.assetCashflowToLiq === "number" ? r0.assetCashflowToLiq : totals.allCashflowToLiq) ?? 0;

  return (
    <div>
      {/* Header (ohne Kachel) */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-50">Schritt 1: Aktiven</h2>
            <p className="mt-2 text-sm text-slate-300">
              Abgeleitet aus Verfügbarkeit + AssetClass. Kein Bucket-Feld.
            </p>
          </div>

          <div className="min-w-0 text-right">
            <div className="text-xs uppercase tracking-wide text-slate-400 whitespace-normal wrap-break-word">
              Gesamtvermögen
            </div>

            <div className="mt-1">
              <Amount value={totals.allValue} size="lg" align="right" />
            </div>

            <div className="mt-2 text-sm text-slate-400">
              Cashflows → Liq p.a.:{" "}
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
                isActive
                  ? "border-sky-500/60 bg-slate-950/60"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700",
              ].join(" ")}
            >
              <button type="button" onClick={() => openDetails(b)} className="block w-full text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{meta.title}</div>
                    <div className="text-xs text-slate-400">{meta.subtitle}</div>
                  </div>
                  <span className="text-xs rounded-full border border-slate-700 px-2 py-1 text-slate-200">
                    {meta.pill}
                  </span>
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
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
            aria-label="Close"
          />

          {/* panel */}
          <div className="absolute inset-x-0 top-6 mx-auto w-[calc(100%-2rem)] max-w-5xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                <div>
                  <div className="font-semibold text-slate-100">Details: {BUCKET_META[activeBucket].title}</div>
                  <div className="text-sm text-slate-400">
                    Du steuerst Label/Wert/Verfügbarkeit/AssetClass/Cashflow/Ziel/Notiz.
                  </div>
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
                  {activeItems.map((p) => (
                    <div
                      key={p.id}
                      tabIndex={-1}
                      className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                      onBlurCapture={(e) => {
                        const next = e.relatedTarget as Node | null;
                        if (next && e.currentTarget.contains(next)) return;
                        void commitIfDirty(p.id); // → ruft onCommit()
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
                          <FieldMoneyInt
                            label="Wert"
                            valueChf={p.amountChf}
                            onChangeChf={(n) => upsert(p.id, { amountChf: n })}
                          />
                        </div>

                        <div>
                          <FieldMoneyInt
                            label="Cashflow p.a."
                            valueChf={p.cashflowPa}
                            onChangeChf={(n) => upsert(p.id, { cashflowPa: n })}
                          />
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
                  ))}

                  {activeItems.length === 0 && (
                    <div className="py-6 text-center text-slate-500">Keine Positionen in diesem Bucket.</div>
                  )}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-2 pr-3 w-[18%]">Position</th>
                        <th className="text-right py-2 pr-3 w-[14%]">Wert</th>
                        <th className="text-left py-2 pr-3 w-[12%]">Verfüg.</th>
                        <th className="text-left py-2 pr-3 w-[14%]">Asset</th>
                        <th className="text-right py-2 pr-3 w-[12%]">Cashflow</th>
                        <th className="text-left py-2 pr-3 w-[10%]">Ziel</th>
                        <th className="text-left py-2 pr-3 w-[8%] hidden xl:table-cell">Bucket</th>
                        <th className="text-left py-2 pr-3 w-[12%]">Notiz</th>
                        <th className="text-right py-2 w-[10%]"> </th>
                      </tr>
                    </thead>

                    <tbody>
                      {activeItems.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-slate-900"
                          onBlur={(e) => {
                            const next = e.relatedTarget as Node | null;
                            if (next && e.currentTarget.contains(next)) return; // Fokus bleibt in Row
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
                            <FieldMoneyInt
                              label=""
                              valueChf={p.amountChf}
                              onChangeChf={(n) => upsert(p.id, { amountChf: n })}
                            />
                          </td>

                          <td className="py-2 pr-3">
                            <select
                              value={p.availability}
                              onChange={(e) => upsert(p.id, { availability: e.target.value as Availability })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                            >
                              <option value="instant">instant</option>
                              <option value="3m_3y">3m_3y</option>
                              <option value="gt_3y">gt_3y</option>
                              <option value="locked">locked</option>
                            </select>
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
                            <FieldMoneyInt
                              label=""
                              valueChf={p.cashflowPa}
                              onChangeChf={(n) => upsert(p.id, { cashflowPa: n })}
                            />
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

                          <td className="py-2 pr-3 text-slate-300 hidden xl:table-cell">
                            {bucketFromAvailability(p.availability)}
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
                      ))}

                      {activeItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-500">
                            Keine Positionen in diesem Bucket.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Regel: Nur Cashflows mit Ziel = liq fliessen in Liquiditäts-Flows. Reinvest bleibt ausserhalb.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
