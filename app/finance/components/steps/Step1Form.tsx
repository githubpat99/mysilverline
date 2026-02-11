// app/finance/components/steps/Step1Form.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FormState,
  AssetPosition,
  DebtPosition,
  Availability,
  AssetClass,
  Goal,
} from "@/lib/types";
import { Amount, InlineAmount } from "../Amount";
import { FieldMoneyInt } from "../fields/FieldMoney";
import { bucketFromAvailability, bucketLabel, type Bucket } from "@/lib/forecast/buckets";
import { Plus, X } from "lucide-react";

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
  ST: { title: "Kurzfristig", subtitle: "Parkieren", pill: "3 Monate – 3 Jahre" },
  LT: { title: "Langfristig", subtitle: "Wachstum", pill: "> 3 Jahre" },
  REAL: { title: "Sachwerte", subtitle: "Substanz", pill: "gebunden" },
};

function bucketToAvailability(b: Bucket): Availability {
  return b === "LIQ" ? "instant" : b === "ST" ? "3m_3y" : b === "LT" ? "gt_3y" : "locked";
}

/**
 * Gegenkonto-Regeln (targetAccountKey):
 * - NIE auf sich selber.
 * - goal="liq": Gegenkonto muss LIQ-Asset sein.
 * - goal="reinvest": Gegenkonto muss Nicht-LIQ-Asset sein (oder intern/self).
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

function hasCashflow(p: AssetPositionUI) {
  return typeof p.cashflowPa === "number" && Math.abs(p.cashflowPa) > 0;
}

type AssetPositionUI = AssetPosition & {
  goal: Goal;
  targetAccountKey?: string;
  sourceAccountKey?: string;
};

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
  const [entered, setEntered] = useState(false);

  // lock body scroll when modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) {
      setEntered(false);
      return;
    }
    const t = window.setTimeout(() => setEntered(true), 20);
    return () => window.clearTimeout(t);
  }, [isModalOpen]);

  // "dirty per position id"
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const committingRef = useRef(false);

  // IMPORTANT: use canonical form field "targetAccountKey" (camelCase) stored in FormState
  const positions: AssetPositionUI[] = (value.positions ?? []) as any;

  const grouped = useMemo(() => {
    const g: Record<Bucket, AssetPositionUI[]> = { LIQ: [], ST: [], LT: [], REAL: [] };
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

  function setPositions(next: AssetPositionUI[]) {
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

    // Save-lock gegen parallele Saves
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      await onCommit();
    } finally {
      committingRef.current = false;
    }
  }

  function ensureCounterAccount(p: AssetPositionUI): AssetPositionUI {
    // Wenn kein Cashflow: Gegenkonto nicht erzwingen
    const hasCf = typeof p.cashflowPa === "number" && Math.abs(p.cashflowPa) > 0;
    if (!hasCf) return p;

    const selfKey = makeKey("asset", p.id);

    // nicht auf sich selbst - ausser bei Re-invest, da ist self ok
    const isSelf = p.targetAccountKey === selfKey;
    let nextKey =
      p.goal === "reinvest"
        ? (p.targetAccountKey ?? undefined) // self ist ok
        : (isSelf ? undefined : p.targetAccountKey ?? undefined);

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
        })();

      if (!ok) {
        // default: erstes LIQ-Asset, aber nicht self
        const candidate = accountOptions.find((o) => o.kind === "asset" && o.bucket === "LIQ" && o.key !== selfKey)?.key;
        return { ...p, targetAccountKey: candidate };
      }

      return { ...p, targetAccountKey: nextKey };
    }

    // goal === "reinvest"
    const ok =
      typeof nextKey === "string" &&
      isValidKey(nextKey, accountOptions) &&
      isAssetKey(nextKey) &&
      (() => {
        const id = keyId(nextKey);
        const opt = accountOptions.find((o) => o.kind === "asset" && o.id === id);
        // erlaubt: self (intern) ODER Nicht-Liquidität
        return nextKey === selfKey || opt?.bucket !== "LIQ";
      })();

    if (!ok) {
      // Default bei reinvest: intern (self)
      return { ...p, targetAccountKey: selfKey };
    }
    return { ...p, targetAccountKey: nextKey };
  }

  function upsert(id: string, patch: Partial<AssetPositionUI>) {
    markDirty(id);
    const next = positions.map((p) => {
      if (p.id !== id) return p;
      const merged = { ...p, ...patch };
      return ensureCounterAccount(merged);
    });
    setPositions(next);
  }

  function addPosition(intoBucket: Bucket) {
    const next: AssetPositionUI = ensureCounterAccount({
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

  const cfTotalUI = sum(positions.map((p) => (typeof p.cashflowPa === "number" ? p.cashflowPa : 0)));
  const cfTotal =
    typeof r0?.assetCashflowReinvest === "number" && typeof r0?.assetCashflowToLiq === "number"
      ? r0.assetCashflowToLiq + r0.assetCashflowReinvest
      : cfTotalUI;

  const missingPrereqs = useMemo(() => {
    const hasLiqAsset = !!defaultLiqAssetKey;
    const hasNonLiqAsset = !!defaultNonLiqAssetKey;
    return { hasLiqAsset, hasNonLiqAsset };
  }, [defaultLiqAssetKey, defaultNonLiqAssetKey]);

  function counterOptionsFor(p: AssetPositionUI) {
    const selfKey = makeKey("asset", p.id);

    if (p.goal === "liq") {
      // nur LIQ-Assets, aber NICHT self
      return accountOptions.filter((o) => o.kind === "asset" && o.bucket === "LIQ" && o.key !== selfKey);
    }

    // reinvest: self erlauben + alle Nicht-LIQ
    return accountOptions.filter((o) => o.kind === "asset" && (o.key === selfKey || o.bucket !== "LIQ"));
  }

  function counterError(p: AssetPositionUI) {
    const hasCf = typeof p.cashflowPa === "number" && Math.abs(p.cashflowPa) > 0;
    if (!hasCf) return "";

    const opts = counterOptionsFor(p);
    if (p.goal === "liq" && opts.length === 0) return "Für Ziel=liq brauchst du mindestens ein LIQ-Konto bei Aktiven.";

    const selfKey = makeKey("asset", p.id);
    if (!p.targetAccountKey) return "Gegenkonto fehlt.";

    if (p.goal === "liq" && p.targetAccountKey === selfKey) {
      return "Gegenkonto darf bei Ziel=liq nicht die gleiche Position sein.";
    }

    if (!opts.some((o) => o.key === p.targetAccountKey)) return "Gegenkonto ist ungültig (falscher Bucket/Ziel).";
    return "";
  }

  function n(x: any) {
    return typeof x === "number" && Number.isFinite(x) ? x : 0;
  }


  return (
    <div>
      {/* Header (ohne Kachel) */}
      <div className="px-5 pt-4 pb-3">
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Gesamtvermögen</div>
              <div className="mt-1 text-lg font-semibold text-slate-50">
                <Amount value={totals.allValue} size="lg" align="left" />
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Cashflow p.a.</div>
              <div className="mt-1 text-lg font-semibold text-slate-50">
                <InlineAmount value={cfTotal} />
              </div>

              {n(cfToLiq) !== 0 && (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    → Liquidität p.a.
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-100">
                    <InlineAmount value={cfToLiq} />
                  </div>
                </div>
              )}
              {n(cfTotal - cfToLiq) !== 0 && (
                <div className="mt-3">
                  <div className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">→ Reinvest p.a.</div>
                  <div className="mt-1 text-base font-semibold text-slate-100">
                    <InlineAmount value={Math.trunc(cfTotal - cfToLiq)} />
                  </div>
                </div>
              )}
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
                {/* Top row: left = Frist + Titel, right = Betrag + CHF */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {/* Frist (wie Step2Form links oben) */}
                    <div className="text-xs font-semibold text-slate-100">
                      {meta.pill}
                    </div>

                    {/* Titel darunter */}
                    <div className="mt-1 text-xs text-slate-400">
                      {meta.title}
                    </div>
                  </div>

                  {/* Betrag rechts (wie Step2Form) */}
                  <div className="min-w-0 text-right">
                    <Amount value={t.totalValue} size="sm" align="right" />
                    {/* Falls Amount bereits CHF anzeigt, kannst du diese Zeile weglassen.
                      Wenn Amount nur die Zahl zeigt, dann CHF ergänzen: */}
                    {/* <div className="text-xs text-slate-400">CHF</div> */}
                  </div>
                </div>

                {/* Cashflow rows */}
                <div className="mt-4 space-y-2 text-sm">
                  {n(t.cashflowLiq) !== 0 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-slate-500">→ Liquidität</span>
                      <span className="text-slate-200 text-right">
                        <InlineAmount value={t.cashflowLiq} />{" "}
                      </span>
                    </div>
                  )}
                  {n(t.cashflowReinvest) !== 0 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-slate-500">→ Reinvest</span>
                      <span className="text-slate-200 text-right">
                        <InlineAmount value={t.cashflowReinvest} />{" "}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 text-xs text-slate-500">
                  Positionen: {t.positions}
                </div>
              </button>

            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          {/* backdrop (kein button, sonst kann er Scroll/Pointer fressen) */}
          <div className="absolute inset-0 bg-slate-700/40" onClick={closeModal} />

          {/*panel */}
          <div
            className={[
              "rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden",
              "transform transition duration-200 ease-out will-change-transform will-change-opacity",
              entered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.985] translate-y-1",
            ].join(" ")}
          >
            <div className="rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ring-1 ring-white/5 max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
              {/* Header bleibt fix */}
              <div className="flex items-start gap-4 border-b border-slate-800 p-4">
                {/* Left: Title */}


                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-100 truncate">
                    {BUCKET_META[activeBucket].title}.
                  </div>

                  {!missingPrereqs.hasLiqAsset && (
                    <div className="mt-2 text-xs text-amber-400/90">
                      Hinweis: Kein LIQ-Aktivenkonto vorhanden.
                    </div>
                  )}
                  {!missingPrereqs.hasNonLiqAsset && (
                    <div className="mt-1 text-xs text-amber-400/90">
                      Hinweis: Re-Invest nur intern möglich.
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex shrink-0 items-start gap-2">
                  {/* Desktop */}
                  <button
                    onClick={() => addPosition(activeBucket)}
                    className="hidden sm:inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-600 whitespace-nowrap"
                    type="button"
                  >
                    + Position
                  </button>
                  <button
                    onClick={closeModal}
                    className="hidden sm:inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-600"
                    type="button"
                  >
                    Schliessen
                  </button>

                  {/* Mobile icons */}
                  <button
                    onClick={() => addPosition(activeBucket)}
                    className="sm:hidden rounded-full border border-slate-700 p-2 hover:border-slate-600"
                    title="Position hinzufügen"
                    type="button"
                  >
                    <Plus size={18} className="text-sky-400" />
                  </button>
                  <button
                    onClick={closeModal}
                    className="sm:hidden rounded-full border border-slate-700 p-2 hover:border-slate-600"
                    title="Schliessen"
                    type="button"
                  >
                    <X size={18} className="text-slate-400 hover:text-slate-100 transition" />
                  </button>
                </div>
              </div>

              {/* Content scrollt */}
              <div className="p-5 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] overflow-x-hidden">
                {/* Mobile: Cards */}
                <div className="space-y-3 md:hidden">
                  {activeItems.map((p) => {
                    const err = counterError(p);

                    return (
                      <div
                        key={p.id}
                        tabIndex={-1}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-3 overflow-x-hidden"
                        onBlurCapture={(e) => {
                          const next = e.relatedTarget as Node | null;
                          if (next && e.currentTarget.contains(next)) return;
                          void commitIfDirty(p.id);
                        }}
                      >
                        <div className="grid gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Bezeichnung</label>
                            <input
                              value={p.label}
                              onChange={(e) => upsert(p.id, { label: e.target.value })}
                              placeholder="z.B. Sparkonto, ETF, Bargeld…"
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Typ</label>
                            <select
                              value={p.assetClass}
                              onChange={(e) => upsert(p.id, { assetClass: e.target.value as AssetClass })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            >
                              <option value="cash">Cash</option>
                              <option value="bank">Bank</option>
                              <option value="securities">Wertschriften</option>
                              <option value="pension">Vorsorge</option>
                              <option value="real_estate">Immobilien</option>
                              <option value="gold">Gold</option>
                              <option value="crypto">Kryptowährungen</option>
                              <option value="other">Sonstiges</option>
                            </select>
                          </div>

                          <FieldMoneyInt
                            label="Wert"
                            valueChf={p.amountChf}
                            onChangeChf={(n) => upsert(p.id, { amountChf: n })}
                          />

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Verfügbarkeit</label>
                            <select
                              value={p.availability}
                              onChange={(e) => upsert(p.id, { availability: e.target.value as Availability })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            >
                              <option value="instant">sofort</option>
                              <option value="3m_3y">3M–3J</option>
                              <option value="gt_3y">&gt; 3J</option>
                              <option value="locked">gebunden</option>
                            </select>
                          </div>

                          <FieldMoneyInt
                            label="Cashflow p.a."
                            valueChf={p.cashflowPa}
                            onChangeChf={(n) => upsert(p.id, { cashflowPa: n })}
                          />

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Ziel</label>
                            <select
                              value={p.goal}
                              onChange={(e) => upsert(p.id, { goal: e.target.value as Goal })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-1 py-2 text-sm text-slate-100"
                            >
                              <option value="liq">liq</option>
                              <option value="reinvest">reinvest</option>
                            </select>
                          </div>

                          {hasCashflow(p) && (
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Gegenkonto</label>
                              <select
                                value={p.targetAccountKey ?? ""}
                                onChange={(e) => upsert(p.id, { targetAccountKey: e.target.value || undefined })}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                              >
                                <option value="">Gegenkonto wählen…</option>
                                {counterOptionsFor(p).map((o) => (
                                  <option key={o.key} value={o.key}>
                                    {o.label}
                                    {o.key === makeKey("asset", p.id) ? " (intern)" : ""}
                                  </option>
                                ))}
                              </select>

                              {err && <div className="mt-1 text-xs text-amber-400/90">{err}</div>}
                            </div>
                          )}

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Notiz</label>
                            <input
                              value={p.notes ?? ""}
                              onChange={(e) => upsert(p.id, { notes: e.target.value })}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                              placeholder="optional"
                            />
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">
                              Bucket: <span className="text-slate-300">{bucketFromAvailability(p.availability)}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removePosition(p.id)}
                              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:border-slate-700 hover:text-slate-100 transition"
                            >
                              Entfernen
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {activeItems.length === 0 && (
                    <div className="py-6 text-center text-slate-500">
                      Keine Positionen in {BUCKET_META[activeBucket].title}.
                    </div>
                  )}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-2 px-3 w-[15%]">Bezeichnung</th>
                        <th className="text-left py-2 px-3 w-[11%]">Typ</th>
                        <th className="text-left py-2 px-3 w-[12%]">Wert</th>
                        <th className="text-left py-2 px-3 w-[12%]">Verf.</th>
                        <th className="text-left py-2 px-3 w-[12%]">Cashflow</th>
                        <th className="text-left py-2 px-3 w-[12%]">Ziel</th>
                        <th className="text-left py-2 px-3 w-[15%]">Gegenkonto</th>
                        <th className="text-left py-2 px-3 w-[11%]">Notiz</th>
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
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="securities">Wertschriften</option>
                                <option value="pension">Vorsorge</option>
                                <option value="real_estate">Immobilien</option>
                                <option value="gold">Gold</option>
                                <option value="crypto">Kryptowährungen</option>
                                <option value="other">Sonstiges</option>
                              </select>
                            </td>

                            <td className="py-2 pr-3">
                              <FieldMoneyInt
                                label=""
                                valueChf={p.amountChf}
                                onChangeChf={(n) => upsert(p.id, { amountChf: n })}
                              />
                            </td>

                            <td className="py-2 pr-3" >
                              <select
                                value={p.availability}
                                onChange={(e) => upsert(p.id, { availability: e.target.value as Availability })}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-1.5 py-2 text-sm text-slate-100"
                              >
                                <option value="instant">sofort</option>
                                <option value="3m_3y">3M–3J</option>
                                <option value="gt_3y">&gt; 3J</option>
                                <option value="locked">gebunden</option>
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
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-1.5 py-2"
                              >
                                <option value="liq">Liquidität</option>
                                <option value="reinvest">Reinvestition</option>
                              </select>
                            </td>

                            <td className="py-2 pr-3 align-top">
                              {hasCashflow(p) ? (
                                <>
                                  <select
                                    value={p.targetAccountKey ?? ""}
                                    onChange={(e) => upsert(p.id, { targetAccountKey: e.target.value || undefined })}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                                  >
                                    <option value="">Gegenkonto wählen…</option>
                                    {counterOptionsFor(p).map((o) => (
                                      <option key={o.key} value={o.key}>
                                        {o.label}
                                        {o.key === makeKey("asset", p.id) ? " (intern)" : ""}
                                      </option>
                                    ))}
                                  </select>

                                  {err && <div className="mt-1 text-xs text-amber-400/90">{err}</div>}
                                </>
                              ) : (
                                <div className="text-xs text-slate-500 italic"></div>
                              )}
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
                                type="button"
                                onClick={() => removePosition(p.id)}
                                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:border-slate-700 hover:text-slate-100 transition"
                              >
                                Entfernen
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {activeItems.length === 0 && (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-slate-500">
                            Keine Positionen in {BUCKET_META[activeBucket].title}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Regeln: Ziel=liq → LIQ-Konto (nicht identisch). Ziel=reinvest → intern (identisch) oder Nicht-LIQ-Konto.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
