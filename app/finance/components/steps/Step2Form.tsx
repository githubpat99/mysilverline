"use client";

import { useMemo, useRef, useState } from "react";
import type { FormState, DebtPosition } from "@/lib/types";
import { FieldMoneyInt } from "../fields/FieldMoney";
import { Amount, InlineAmount } from "../Amount";

type Step2Data = FormState["step2"];
type DebtBucket = "immediate" | "mid" | "long";
type DebtType = DebtPosition["debtType"];

function uid() {
  return "d_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function bucketToAvailability(b: DebtBucket): DebtPosition["availability"] {
  if (b === "immediate") return "instant";
  if (b === "mid") return "3m_3y";
  return "gt_3y";
}

function availabilityToBucket(a: DebtPosition["availability"]): DebtBucket {
  if (a === "instant") return "immediate";
  if (a === "3m_3y") return "mid";
  return "long";
}

function bucketLabel(b: DebtBucket) {
  switch (b) {
    case "immediate":
      return "Sofort";
    case "mid":
      return "3m–3y";
    case "long":
      return ">3y";
  }
}

function bucketHint(b: DebtBucket) {
  switch (b) {
    case "immediate":
      return "z.B. Kreditkarte, offene Rechnungen";
    case "mid":
      return "z.B. Konsumkredit, kurzfristige Darlehen";
    case "long":
      return "z.B. Hypothek, langfristige Darlehen";
  }
}

function typeLabel(t: DebtType) {
  switch (t) {
    case "mortgage":
      return "Hypothek";
    case "loan":
      return "Darlehen";
    case "consumer":
      return "Konsumkredit";
    case "creditcard":
      return "Kreditkarte";
    case "other":
      return "Andere";
  }
}

export default function Step2Form({
  value,
  onChange,
  onCommit,
}: {
  value: Step2Data;
  onChange: (next: Step2Data) => void;
  onCommit?: () => void | Promise<void>;
}) {
  const positions: DebtPosition[] = Array.isArray((value as any).positions)
    ? ((value as any).positions as DebtPosition[])
    : [];

  const buckets: DebtBucket[] = ["immediate", "mid", "long"];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeBucket, setActiveBucket] = useState<DebtBucket>("immediate");

  // dirty per id
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const committingRef = useRef(false);

  function setPositions(next: DebtPosition[]) {
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

    if (committingRef.current) return;
    committingRef.current = true;
    try {
      await onCommit();
    } finally {
      committingRef.current = false;
    }
  }

  function addPosition(bucket: DebtBucket) {
    const next: DebtPosition = {
      id: uid(),
      label: "",
      balanceChf: 0,
      currency: "CHF",
      availability: bucketToAvailability(bucket),
      debtType: bucket === "long" ? "mortgage" : bucket === "immediate" ? "creditcard" : "consumer",
      interestRatePct: undefined,
      amortizationType: "none",
      amortizationPaChf: 0,
      notes: "",
    };
    markDirty(next.id);
    setPositions([...positions, next]);
  }

  function updatePosition(id: string, patch: Partial<DebtPosition>) {
    markDirty(id);
    setPositions(positions.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removePosition(id: string) {
    markDirty(id);
    setPositions(positions.filter((x) => x.id !== id));
  }

  function listForBucket(bucket: DebtBucket): DebtPosition[] {
    return positions.filter((p) => availabilityToBucket(p.availability) === bucket);
  }

  function openDetails(bucket: DebtBucket) {
    setActiveBucket(bucket);
    setIsModalOpen(true);
  }

  function closeModal() {
    void commitIfDirty();
    setIsModalOpen(false);
  }

  const totals = useMemo(() => {
    const byBucket: Record<DebtBucket, number> = { immediate: 0, mid: 0, long: 0 };
    const counts: Record<DebtBucket, number> = { immediate: 0, mid: 0, long: 0 };

    for (const p of positions) {
      const b = availabilityToBucket(p.availability);
      byBucket[b] += typeof p.balanceChf === "number" ? p.balanceChf : 0;
      counts[b] += 1;
    }

    const totalAll = byBucket.immediate + byBucket.mid + byBucket.long;
    return { byBucket, counts, totalAll };
  }, [positions]);

  const debtFlows = useMemo(() => {
    const interestPa = positions.reduce((sum, p) => {
      const bal = typeof p.balanceChf === "number" ? p.balanceChf : 0;
      const r = typeof p.interestRatePct === "number" ? p.interestRatePct : 0;
      if (!bal || !r) return sum;
      return sum + Math.trunc((bal * r) / 100);
    }, 0);

    const amortPa = positions.reduce((sum, p) => {
      const a = typeof p.amortizationPaChf === "number" ? p.amortizationPaChf : 0;
      if (!a) return sum;
      return sum + Math.max(0, Math.trunc(a));
    }, 0);

    return { interestPa, amortPa, burdenPa: interestPa + amortPa };
  }, [positions]);

  const activeItems = listForBucket(activeBucket);

  return (
    <div>
      {/* Header (ohne Kachel) */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-50">Schritt 2: Passiven</h2>
            <p className="mt-2 text-sm text-slate-300">Laufzeiten gem. Spending-Instruments.</p>
          </div>

          <div className="min-w-0 text-right">
            <div className="text-xs uppercase tracking-wide text-slate-400 whitespace-normal break-words">
              Gesamtverpflichtungen
            </div>

            <div className="mt-1">
              <Amount value={totals.totalAll} size="lg" align="right" />
            </div>

            <div className="mt-2 space-y-1 text-sm text-slate-400">
              <div>
                Zinsen → Liq p.a.:{" "}
                <span className="text-slate-200">
                  <InlineAmount value={debtFlows.interestPa} />
                </span>
              </div>
              <div>
                Amort. → Liq p.a.:{" "}
                <span className="text-slate-200">
                  <InlineAmount value={debtFlows.amortPa} />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-800/80" />
      </div>

      {/* Tiles */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {buckets.map((b) => {
          const total = totals.byBucket[b];
          const count = totals.counts[b];

          return (
            <div
              key={b}
              className="rounded-2xl border p-4 transition cursor-pointer border-slate-800 bg-slate-950/40 hover:border-slate-700"
              role="button"
              tabIndex={0}
              onClick={() => openDetails(b)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openDetails(b);
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100">{bucketLabel(b)}</div>
                  <div className="text-xs text-slate-400">{bucketHint(b)}</div>
                </div>

                <div className="min-w-0 text-right">
                  <Amount value={total} size="sm" align="right" />
                  <div className="text-xs text-slate-400">Positionen: {count}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">Klick für Details</div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={closeModal} aria-label="Close" />

          <div className="absolute inset-x-0 top-6 mx-auto w-[calc(100%-2rem)] max-w-5xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                <div>
                  <div className="font-semibold text-slate-100">Details: {bucketLabel(activeBucket)}</div>
                  <div className="text-sm text-slate-400">
                    Du steuerst Bezeichnung/Typ/Saldo/Zins. Laufzeit ist bucket-basiert.
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
                  {activeItems.map((it) => (
                    <div
                      key={it.id}
                      tabIndex={-1}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-3"
                      onBlurCapture={(e) => {
                        const next = e.relatedTarget as Node | null;
                        if (next && e.currentTarget.contains(next)) return;
                        void commitIfDirty(it.id);
                      }}
                    >
                      <div className="grid gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Bezeichnung</label>
                          <input
                            value={it.label}
                            onChange={(e) => updatePosition(it.id, { label: e.target.value })}
                            placeholder="z.B. Raiffeisen Hypothek, Visa, Autokredit…"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Typ</label>
                          <select
                            value={it.debtType}
                            onChange={(e) => updatePosition(it.id, { debtType: e.target.value as DebtType })}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                          >
                            <option value="mortgage">{typeLabel("mortgage")}</option>
                            <option value="loan">{typeLabel("loan")}</option>
                            <option value="consumer">{typeLabel("consumer")}</option>
                            <option value="creditcard">{typeLabel("creditcard")}</option>
                            <option value="other">{typeLabel("other")}</option>
                          </select>
                        </div>

                        <FieldMoneyInt
                          label="Saldo"
                          valueChf={it.balanceChf}
                          onChangeChf={(n) => updatePosition(it.id, { balanceChf: n })}
                        />

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">%</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            inputMode="decimal"
                            value={
                              typeof it.interestRatePct === "number" && Number.isFinite(it.interestRatePct)
                                ? String(it.interestRatePct)
                                : ""
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              const n = raw.trim() === "" ? undefined : Number(String(raw).replace(",", "."));
                              updatePosition(it.id, {
                                interestRatePct: typeof n === "number" && Number.isFinite(n) ? n : undefined,
                              });
                            }}
                            placeholder="z.B. 1.80"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                          />
                        </div>

                        {(it.debtType === "mortgage" || it.debtType === "loan") && (
                          <>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Amortisation</label>
                              <select
                                value={it.amortizationType ?? "none"}
                                onChange={(e) =>
                                  updatePosition(it.id, {
                                    amortizationType: e.target.value as any,
                                    amortizationPaChf:
                                      e.target.value === "none" ? 0 : it.amortizationPaChf ?? 0,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                              >
                                <option value="none">Keine</option>
                                <option value="direct">Direkt</option>
                                <option value="indirect">Indirekt (3a/PK)</option>
                              </select>
                            </div>

                            <FieldMoneyInt
                              label="Amortisation p.a."
                              valueChf={typeof it.amortizationPaChf === "number" ? it.amortizationPaChf : 0}
                              onChangeChf={(n) => updatePosition(it.id, { amortizationPaChf: n })}
                            />
                          </>
                        )}

                        <div className="mt-1 flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">
                            Laufzeit: <span className="text-slate-300">{bucketLabel(activeBucket)}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removePosition(it.id)}
                            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:border-slate-700 hover:text-slate-100 transition"
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table (wie Step-1) */}
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-2 pr-3 w-[28%]">Bezeichnung</th>
                        <th className="text-left py-2 pr-3 w-[16%]">Typ</th>
                        <th className="text-right py-2 pr-3 w-[16%]">Saldo</th>
                        <th className="text-right py-2 pr-3 w-[10%]">%</th>
                        <th className="text-left py-2 pr-3 w-[14%]">Amort.</th>
                        <th className="text-right py-2 pr-3 w-[16%]">p.a.</th>
                        <th className="text-right py-2 w-[10%]"></th>
                      </tr>
                    </thead>

                    <tbody>
                      {activeItems.map((it) => (
                        <tr
                          key={it.id}
                          className="border-b border-slate-900"
                          onBlur={(e) => {
                            const next = e.relatedTarget as Node | null;
                            if (next && e.currentTarget.contains(next)) return;
                            void commitIfDirty(it.id);
                          }}
                        >
                          <td className="py-2 pr-3">
                            <input
                              value={it.label}
                              onChange={(e) => updatePosition(it.id, { label: e.target.value })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                              placeholder="z.B. Visa, Hypothek…"
                            />
                          </td>

                          <td className="py-2 pr-3">
                            <select
                              value={it.debtType}
                              onChange={(e) => updatePosition(it.id, { debtType: e.target.value as DebtType })}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                            >
                              <option value="mortgage">{typeLabel("mortgage")}</option>
                              <option value="loan">{typeLabel("loan")}</option>
                              <option value="consumer">{typeLabel("consumer")}</option>
                              <option value="creditcard">{typeLabel("creditcard")}</option>
                              <option value="other">{typeLabel("other")}</option>
                            </select>
                          </td>

                          <td className="py-2 pr-3">
                            <FieldMoneyInt
                              label=""
                              valueChf={it.balanceChf}
                              onChangeChf={(n) => updatePosition(it.id, { balanceChf: n })}
                            />
                          </td>

                          <td className="py-2 pr-3">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              max={100}
                              inputMode="decimal"
                              value={
                                typeof it.interestRatePct === "number" && Number.isFinite(it.interestRatePct)
                                  ? String(it.interestRatePct)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                const n = raw.trim() === "" ? undefined : Number(String(raw).replace(",", "."));
                                updatePosition(it.id, {
                                  interestRatePct: typeof n === "number" && Number.isFinite(n) ? n : undefined,
                                });
                              }}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-right"
                              placeholder="1.80"
                            />
                          </td>

                          <td className="py-2 pr-3">
                            <select
                              value={it.amortizationType ?? "none"}
                              onChange={(e) =>
                                updatePosition(it.id, {
                                  amortizationType: e.target.value as any,
                                  amortizationPaChf: e.target.value === "none" ? 0 : it.amortizationPaChf ?? 0,
                                })
                              }
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                            >
                              <option value="none">Keine</option>
                              <option value="direct">Direkt</option>
                              <option value="indirect">Indirekt</option>
                            </select>
                          </td>

                          <td className="py-2 pr-3">
                            <FieldMoneyInt
                              label=""
                              valueChf={typeof it.amortizationPaChf === "number" ? it.amortizationPaChf : 0}
                              onChangeChf={(n) => updatePosition(it.id, { amortizationPaChf: n })}
                            />
                          </td>

                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removePosition(it.id)}
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:border-slate-700 hover:text-slate-100 transition"
                            >
                              Entfernen
                            </button>
                          </td>
                        </tr>
                      ))}

                      {activeItems.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            Keine Positionen in {bucketLabel(activeBucket)}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Regel: Zinsen & Amortisation belasten die Liquidität (später im Forecast als Flows modelliert).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
