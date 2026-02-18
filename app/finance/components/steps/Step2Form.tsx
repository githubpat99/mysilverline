// app/finance/components/steps/Step2Form.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormState, DebtPosition, AssetPosition } from "@/lib/types";
import { FieldMoneyInt } from "../fields/FieldMoney";
import { Amount, InlineAmount } from "../Amount";
import { bucketFromAvailability, availabilityFromBucket } from "@/lib/forecast/buckets";
import type { Availability, Bucket } from "@/lib/forecast/buckets";
import { Plus, Trash2, X } from "lucide-react";
import CustomSelect from "../CustomSelect";

/**
 * TYPE-ÄNDERUNGEN (in "@/lib/types")
 *
 * 1) DebtPosition:
 *   - amortizationType?: AmortizationType;   // REMOVE
 *   + sourceAccountKey?: string;            // "asset:<id>" | "debt:<id>"
 *
 * 2) AssetPosition (vom User gewünscht, ebenfalls Gegenkonto):
 *   + counterAccountKey?: string;           // "asset:<id>" | "debt:<id>" (optional)
 *   (Step2Form nutzt das nicht, aber Typ soll erweitert werden.)
 */

type Step2Data = FormState["step2"];
type DebtType = DebtPosition["debtType"];

const buckets: Bucket[] = ["LIQ", "ST", "LT", "REAL"];

const BUCKET_META: Record<Bucket, { title: string; subtitle: string; hint: string }> = {
  LIQ: { title: "Sofort", subtitle: "kurz fällig", hint: "z.B. Kreditkarte, offene Rechnungen" },
  ST: { title: "3 Monate – 3 Jahre", subtitle: "mittelfristig", hint: "z.B. Konsumkredit, kurzfristige Darlehen" },
  LT: { title: "> 3 Jahre", subtitle: "langfristig", hint: "z.B. Hypothek, langfristige Darlehen" },
  REAL: { title: "Gebunden", subtitle: "nicht disponibel", hint: "z.B. verpfändet/gebunden (falls relevant)" },
};

function uid() {
  return "d_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
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

function isShortBucket(b: Bucket) {
  return b === "LIQ" || b === "ST";
}

export default function Step2Form({
  value,
  onChange,
  onCommit,
  assets, // <-- wichtig: Step2 braucht Zugriff auf existierende Aktiven
}: {
  value: Step2Data;
  onChange: (next: Step2Data) => void;
  onCommit?: () => void | Promise<void>;
  assets: AssetPosition[];
}) {
  const positions: (DebtPosition & { sourceAccountKey?: string })[] = Array.isArray((value as any).positions)
    ? (((value as any).positions as any[]) as (DebtPosition & { sourceAccountKey?: string })[])
    : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeBucket, setActiveBucket] = useState<Bucket>("LIQ");

  useEffect(() => {
    if (!isModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModalOpen]);

  // dirty per id
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const committingRef = useRef(false);

  function setPositions(
    updater: DebtPosition[] | ((prev: DebtPosition[]) => DebtPosition[])
  ) {
    const prev = (value.positions ?? []) as DebtPosition[];
    const next = typeof updater === "function" ? updater(prev) : updater;
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

  const sourceAccountOptions: AccountOption[] = useMemo(() => {
    return (assets ?? [])
      .filter((x) => x.availability === "instant") // ✅ NUR LIQ
      .map((x) => {
        const label = x.label?.trim() ? x.label : "Liquidität";
        return {
          key: makeKey("asset", x.id),
          label,
          bucket: "LIQ",
          kind: "asset",
          id: x.id,
        };
      });
  }, [assets]);


  const defaultLiquidityAccountKey = useMemo(() => {
    return sourceAccountOptions[0]?.key;
  }, [sourceAccountOptions]);


  function isValidSourceKey(key: string | undefined): boolean {
    if (!key) return false;
    return sourceAccountOptions.some((o) => o.key === key);
  }

  useEffect(() => {
    if (!defaultLiquidityAccountKey) return;

    setPositions(prev => {
      let changed = false;

      const next = prev.map(p => {
        const np = ensureSourceForShortBuckets(p);
        if (np !== p) changed = true;
        return np;
      });

      return changed ? next : prev;
    });
  }, [defaultLiquidityAccountKey]);

  // Sofort: Default Amortisation = Gesamtbetrag (nur beim Öffnen des Modals)
  useEffect(() => {
    if (!isModalOpen || activeBucket !== "LIQ") return;
    setPositions(prev => {
      let changed = false;
      const next = prev.map(p => {
        if (p.availability !== "instant") return p;
        const bal = typeof p.balanceChf === "number" ? p.balanceChf : 0;
        const amort = typeof p.amortizationPaChf === "number" ? p.amortizationPaChf : 0;
        if (bal > 0 && amort === 0) {
          changed = true;
          return { ...p, amortizationPaChf: bal };
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [isModalOpen, activeBucket]);

  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!isModalOpen) {
      setEntered(false);
      return;
    }
    const t = window.setTimeout(() => setEntered(true), 10);
    return () => window.clearTimeout(t);
  }, [isModalOpen]);


  function ensureSourceForShortBuckets(p: DebtPosition): DebtPosition {
    if (!defaultLiquidityAccountKey) return p;

    const cur = p.sourceAccountKey;

    // Immer: wenn keine gültige Quelle → Default = Liquidität (is_system Konto)
    if (cur && isValidSourceKey(cur)) return p;

    return cur !== defaultLiquidityAccountKey
      ? { ...p, sourceAccountKey: defaultLiquidityAccountKey }
      : p;
  }

  function addPosition(bucket: Bucket) {
    const next: DebtPosition & { sourceAccountKey?: string } = ensureSourceForShortBuckets({
      id: uid(),
      label: "",
      balanceChf: 0,
      currency: "CHF",
      availability: availabilityFromBucket(bucket),

      // debtType Default (nur UX):
      debtType: bucket === "LT" || bucket === "REAL" ? "mortgage" : bucket === "LIQ" ? "creditcard" : "consumer",

      interestRatePct: undefined,

      // neu: Quelle/Gegenkonto = immer Liquidität (is_system Konto)
      sourceAccountKey: defaultLiquidityAccountKey ?? undefined,

      amortizationPaChf: 0,
      notes: "",
    });

    markDirty(next.id);
    setPositions([...positions, next]);
  }

  function updatePosition(id: string, patch: Partial<DebtPosition & { sourceAccountKey?: string }>) {
    markDirty(id);
    const next = positions.map((x) => {
      if (x.id !== id) return x;
      const merged = { ...x, ...patch };
      return ensureSourceForShortBuckets(merged);
    });
    setPositions(next);
  }

  function removePosition(id: string) {
    markDirty(id);
    setPositions(positions.filter((x) => x.id !== id));
  }

  function listForBucket(bucket: Bucket) {
    return positions.filter((p) => bucketFromAvailability(p.availability) === bucket);
  }

  function openDetails(bucket: Bucket) {
    setActiveBucket(bucket);
    setIsModalOpen(true);
  }

  function closeModal() {
    void commitIfDirty();
    setIsModalOpen(false);
  }

  const totals = useMemo(() => {
    const byBucket: Record<Bucket, number> = { LIQ: 0, ST: 0, LT: 0, REAL: 0 };
    const counts: Record<Bucket, number> = { LIQ: 0, ST: 0, LT: 0, REAL: 0 };

    for (const p of positions) {
      const b = bucketFromAvailability(p.availability);
      byBucket[b] += typeof p.balanceChf === "number" ? p.balanceChf : 0;
      counts[b] += 1;
    }

    const totalAll = byBucket.LIQ + byBucket.ST + byBucket.LT + byBucket.REAL;
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
      {/* Header */}
      <div className="px-5 pt-0 pb-3">

        {/* KPI row */}
        <div className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                Gesamtverpflichtungen
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-50">
                <Amount value={totals.totalAll} size="lg" align="left" />
              </div>
            </div>

            <div className="min-w-0 sm:text-right">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                Zinsen p.a.
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-50">
                <InlineAmount value={debtFlows.interestPa} />
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                Amort. p.a.
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-50">
                <InlineAmount value={debtFlows.amortPa} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-800/80" />
      </div>

      {/* Tiles */}
      <div className="mt-0 grid gap-4 md:grid-cols-2">
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
                  <div className="text-sm font-semibold text-slate-100">{BUCKET_META[b].title}</div>
                  <div className="text-xs text-slate-400">{BUCKET_META[b].hint}</div>
                </div>

                <div className="min-w-0 text-right">
                  <Amount value={total} size="sm" align="right" />
                  <div className="text-xs text-slate-400">Positionen: {count}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          {/* backdrop (kein button, sonst kann er Scroll/Pointer fressen) */}
          <div
            className="absolute inset-0 bg-slate-700/40"
            onClick={closeModal}
          />

          {/*panel */}
          <div
            className={[
              "rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden",
              "transform transition duration-200 ease-out will-change-transform will-change-opacity",
              entered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.985] translate-y-1",
            ].join(" ")}
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
              {/* Header bleibt fix */}
              <div className="flex items-start gap-4 border-b border-slate-800 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-100 truncate">
                    {BUCKET_META[activeBucket].title}.
                  </div>

                  {!defaultLiquidityAccountKey && (
                    <div className="mt-2 text-xs text-amber-400/90">
                      Hinweis: Kein LIQ-Aktivenkonto gefunden. Für LIQ/ST-Schulden fehlt das Default-Gegenkonto.
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-start gap-2">
                  {/* Desktop */}
                  <button
                    onClick={() => addPosition(activeBucket)}
                    className="hidden sm:inline-flex items-center justify-center rounded-full border border-slate-700 p-2.5 text-sm hover:border-slate-600"
                    type="button"
                    title="Position hinzufügen"
                  >
                    <Plus size={18} className="text-sky-400" />
                  </button>
                  <button
                    onClick={closeModal}
                    className="hidden sm:inline-flex items-center justify-center rounded-full border border-slate-700 p-2.5 text-sm hover:border-slate-600"
                    type="button"
                    title="Schliessen"
                  >
                    <X size={18} className="text-slate-400" />
                  </button>

                  {/* Mobile icons (min 44px Touch-Target) */}
                  <button
                    onClick={() => addPosition(activeBucket)}
                    className="sm:hidden flex size-11 items-center justify-center rounded-full border border-slate-700 hover:border-slate-600 touch-manipulation"
                    title="Position hinzufügen"
                    type="button"
                  >
                    <Plus size={20} className="text-sky-400" />
                  </button>
                  <button
                    onClick={closeModal}
                    className="sm:hidden flex size-11 items-center justify-center rounded-full border border-slate-700 hover:border-slate-600 touch-manipulation"
                    title="Schliessen"
                    type="button"
                  >
                    <X size={20} className="text-slate-400 hover:text-slate-100 transition" />
                  </button>
                </div>
              </div>

              {/* Content scrollt */}
              <div className="p-5 overflow-y-auto overflow-x-hidden overscroll-contain [webkit-overflow-scrolling:touch]">
                {/* Mobile: Cards */}
                <div className="space-y-3 md:hidden">
                  {activeItems.map((it) => {
                    const needsSource = (activeBucket === "LT" || activeBucket === "REAL") && !isValidSourceKey(it.sourceAccountKey);
                    const sourceLocked = isShortBucket(activeBucket);

                    return (
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
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <label className="block text-xs text-slate-400 mb-1">Bezeichnung</label>
                            <input
                              value={it.label}
                              onChange={(e) => updatePosition(it.id, { label: e.target.value })}
                              placeholder="z.B. Raiffeisen Hypothek, Visa, Autokredit…"
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                            />
                            </div>
                            {!it.isSystem && (
                              <button
                                type="button"
                                onClick={() => removePosition(it.id)}
                                className="flex shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-300 hover:border-slate-700 hover:text-slate-100 transition"
                                title="Entfernen"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Typ</label>
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Typ">
                              {(["mortgage", "loan", "consumer", "creditcard", "other"] as DebtType[]).map((dv) => (
                                <button
                                  key={dv}
                                  type="button"
                                  role="radio"
                                  aria-checked={it.debtType === dv}
                                  onClick={() => updatePosition(it.id, { debtType: dv })}
                                  className={[
                                    "rounded-lg border px-2.5 py-1.5 text-xs transition",
                                    it.debtType === dv ? "border-sky-500/60 bg-slate-800 text-sky-200" : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-600 hover:text-slate-200",
                                  ].join(" ")}
                                >
                                  {typeLabel(dv)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <FieldMoneyInt
                            label="Wert"
                            valueChf={it.balanceChf}
                            onChangeChf={(n) => updatePosition(it.id, { balanceChf: n })}
                            onBlurChf={(n) => {
                              if (it.availability !== "instant") return;
                              const amort = typeof it.amortizationPaChf === "number" ? it.amortizationPaChf : 0;
                              if (n > 0 && amort === 0) updatePosition(it.id, { amortizationPaChf: n });
                            }}
                          />

                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Verfügbarkeit</label>
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Verfügbarkeit">
                              {[
                                { v: "instant" as Availability, l: "sofort" },
                                { v: "3m_3y" as Availability, l: "3M–3J" },
                                { v: "gt_3y" as Availability, l: ">3J" },
                                { v: "locked" as Availability, l: "gebunden" },
                              ].map((o) => (
                                <button
                                  key={o.v}
                                  type="button"
                                  role="radio"
                                  aria-checked={it.availability === o.v}
                                  onClick={() => updatePosition(it.id, { availability: o.v })}
                                  className={[
                                    "rounded-lg border px-2.5 py-1.5 text-xs transition",
                                    it.availability === o.v ? "border-sky-500/60 bg-slate-800 text-sky-200" : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-600 hover:text-slate-200",
                                  ].join(" ")}
                                >
                                  {o.l}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Zins (%)</label>
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

                          <div>
                            <CustomSelect
                              label="Quelle (Gegenkonto)"
                              options={[
                                { value: "", label: sourceLocked ? "Liquidität (Default)" : "Quelle wählen…" },
                                ...sourceAccountOptions.map((o) => ({ value: o.key, label: o.label })),
                              ]}
                              value={it.sourceAccountKey ?? ""}
                              onChange={(v) => updatePosition(it.id, { sourceAccountKey: v || undefined })}
                              placeholder={sourceLocked ? "Liquidität (Default)" : "Quelle wählen…"}
                              disabled={sourceAccountOptions.length <= 1}
                            />
                            {needsSource && (
                              <div className="mt-1 text-xs text-amber-400/90">Quelle fehlt – muss ein bestehendes Konto sein.</div>
                            )}
                          </div>

                          <FieldMoneyInt
                            label="Amortisation p.a."
                            valueChf={typeof it.amortizationPaChf === "number" ? it.amortizationPaChf : 0}
                            onChangeChf={(n) => updatePosition(it.id, { amortizationPaChf: n })}
                          />

                          <div className="mt-1 text-xs text-slate-500">
                            Laufzeit: <span className="text-slate-300">{BUCKET_META[activeBucket].title}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="py-2 w-[7%]"> </th>
                        <th className="text-left py-2 px-3 w-[15%]">Bezeichnung</th>
                        <th className="text-left py-2 px-3 w-[11%]">Typ</th>
                        <th className="text-left py-2 px-3 w-[12%]">Wert</th>
                        <th className="text-left py-2 px-3 w-[12%]">Verf.</th>
                        <th className="text-left py-2 px-3 w-[12%]">Amort.</th>
                        <th className="text-left py-2 px-3 w-[10%]">Zins (%)</th>
                        <th className="text-left py-2 px-3 w-[15%]">Quelle</th>
                        <th className="text-left py-2 px-3 w-[13%]">Notiz</th>
                      </tr>
                    </thead>

                    <tbody>
                      {activeItems.map((it) => {
                        const needsSource =
                          (activeBucket === "LT" || activeBucket === "REAL") && !isValidSourceKey(it.sourceAccountKey);
                        const sourceLocked = isShortBucket(activeBucket);

                        return (
                          <tr
                            key={it.id}
                            className="border-b border-slate-900"
                            onBlur={(e) => {
                              const next = e.relatedTarget as Node | null;
                              if (next && e.currentTarget.contains(next)) return;
                              void commitIfDirty(it.id);
                            }}
                          >
                            <td className="py-2 pr-1">
                              {!it.isSystem ? (
                                <button
                                  type="button"
                                  onClick={() => removePosition(it.id)}
                                  className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-300 hover:border-slate-700 hover:text-slate-100 transition"
                                  title="Entfernen"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </td>

                            {/* Bezeichnung */}
                            <td className="py-2 pr-3">
                              <input
                                value={it.label}
                                onChange={(e) => updatePosition(it.id, { label: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                                placeholder="z.B. Visa, Hypothek…"
                              />
                            </td>

                            {/* Typ */}
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Typ">
                                {(["mortgage", "loan", "consumer", "creditcard", "other"] as DebtType[]).map((dv) => (
                                  <button
                                    key={dv}
                                    type="button"
                                    role="radio"
                                    aria-checked={it.debtType === dv}
                                    onClick={() => updatePosition(it.id, { debtType: dv })}
                                    className={[
                                      "rounded border px-1.5 py-0.5 text-[11px] transition",
                                      it.debtType === dv ? "border-sky-500/60 bg-slate-800 text-sky-200" : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-600",
                                    ].join(" ")}
                                  >
                                    {typeLabel(dv)}
                                  </button>
                                ))}
                              </div>
                            </td>

                            {/* Wert */}
                            <td className="py-2 pr-3">
                              <FieldMoneyInt
                                label=""
                                valueChf={it.balanceChf}
                                onChangeChf={(n) => updatePosition(it.id, { balanceChf: n })}
                                onBlurChf={(n) => {
                                  if (it.availability !== "instant") return;
                                  const amort = typeof it.amortizationPaChf === "number" ? it.amortizationPaChf : 0;
                                  if (n > 0 && amort === 0) updatePosition(it.id, { amortizationPaChf: n });
                                }}
                              />
                            </td>

                            {/* Verfügbarkeit */}
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Verfügbarkeit">
                                {[
                                  { v: "instant" as Availability, l: "sofort" },
                                  { v: "3m_3y" as Availability, l: "3M–3J" },
                                  { v: "gt_3y" as Availability, l: ">3J" },
                                  { v: "locked" as Availability, l: "gebunden" },
                                ].map((o) => (
                                  <button
                                    key={o.v}
                                    type="button"
                                    role="radio"
                                    aria-checked={it.availability === o.v}
                                    onClick={() => updatePosition(it.id, { availability: o.v })}
                                    className={[
                                      "rounded border px-1.5 py-0.5 text-[11px] transition",
                                      it.availability === o.v ? "border-sky-500/60 bg-slate-800 text-sky-200" : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-600",
                                    ].join(" ")}
                                  >
                                    {o.l}
                                  </button>
                                ))}
                              </div>
                            </td>

                            {/* Amortisation p.a. */}
                            <td className="py-2 pr-3">
                              <FieldMoneyInt
                                label=""
                                valueChf={typeof it.amortizationPaChf === "number" ? it.amortizationPaChf : 0}
                                onChangeChf={(n) => updatePosition(it.id, { amortizationPaChf: n })}
                              />
                            </td>

                            {/* Zins % */}
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
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-1.5 py-2 text-right"
                                placeholder="1.80"
                              />
                            </td>

                            {/* Quelle (Gegenkonto) */}
                            <td className="py-2 pr-3 align-top">
                              <CustomSelect
                                options={[
                                  { value: "", label: sourceLocked ? "Liquidität (Default)" : "Quelle wählen…" },
                                  ...sourceAccountOptions.map((o) => ({ value: o.key, label: o.label })),
                                ]}
                                value={it.sourceAccountKey ?? ""}
                                onChange={(v) => updatePosition(it.id, { sourceAccountKey: v || undefined })}
                                placeholder={sourceLocked ? "Liquidität (Default)" : "Quelle wählen…"}
                                disabled={sourceAccountOptions.length <= 1}
                              />
                              {needsSource && (
                                <div className="mt-1 text-xs text-amber-400/90">
                                  Quelle fehlt – muss ein bestehendes Konto sein.
                                </div>
                              )}
                            </td>

                            {/* Notiz */}
                            <td className="py-2 pr-3">
                              <input
                                value={it.notes ?? ""}
                                onChange={(e) => updatePosition(it.id, { notes: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                                placeholder="optional"
                              />
                            </td>
                          </tr>
                        );
                      })}

                      {activeItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-500">
                            Keine Positionen in {BUCKET_META[activeBucket].title}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Regel: Zinsen belasten die Liquidität. Amortisation ist als CHF p.a. erfasst; Quelle muss ein existierendes Konto sein.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
