// app/finance/components/steps/Step1Form.tsx
"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import CustomSelect from "../CustomSelect";

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

const ASSET_CLASS_OPTIONS: { v: AssetClass; l: string }[] = [
  { v: "cash", l: "Cash" },
  { v: "bank", l: "Bank" },
  { v: "securities", l: "Wertschr." },
  { v: "pension", l: "Vorsorge" },
  { v: "real_estate", l: "Immo" },
  { v: "gold", l: "Gold" },
  { v: "crypto", l: "Krypto" },
  { v: "other", l: "Sonstiges" },
];
const ASSET_CLASS_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CLASS_OPTIONS.map((o) => [o.v, o.l]),
);
const AVAILABILITY_OPTIONS: { v: Availability; l: string }[] = [
  { v: "instant", l: "sofort" },
  { v: "3m_3y", l: "3M–3J" },
  { v: "gt_3y", l: ">3J" },
  { v: "locked", l: "gebunden" },
];

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

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    if (p.goal === "liq" && opts.length === 0) return "Für Ziel=Liquidität brauchst du mindestens ein LIQ-Konto bei Aktiven.";

    const selfKey = makeKey("asset", p.id);
    if (!p.targetAccountKey) return "Gegenkonto fehlt.";

    if (p.goal === "liq" && p.targetAccountKey === selfKey) {
      return "Gegenkonto darf bei Ziel=Liquidität nicht die gleiche Position sein.";
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
      <div className="px-5 pt-0 pb-3">
        <div className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Gesamtvermögen</div>
              <div className="mt-1 text-lg font-semibold text-slate-50">
                <Amount value={totals.allValue} size="lg" align="left" />
              </div>
            </div>

            <div className="min-w-0 sm:text-right">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Ertrag p.a.</div>
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
                  <div className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">→ Wiederanlage p.a.</div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-0">
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
                      <span className="text-slate-500">→ Wiederanlage</span>
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
              <div className="p-5 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] overflow-x-hidden">
                {/* Mobile: Cards */}
                <div className="space-y-3 lg:hidden">
                  {activeItems.map((p) => {
                    const err = counterError(p);

                    return (
                      <div
                        key={p.id}
                        tabIndex={-1}
                        className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden"
                        onBlurCapture={(e) => {
                          const next = e.relatedTarget as Node | null;
                          if (next && e.currentTarget.contains(next)) return;
                          void commitIfDirty(p.id);
                        }}
                      >
                        <div
                          className="flex w-full items-center gap-2 px-3 py-3 cursor-pointer"
                          onClick={() => toggleExpand(p.id)}
                        >
                          {!p.isSystem && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removePosition(p.id); }}
                              className="shrink-0 p-1 text-slate-500 hover:text-red-400 transition"
                              title="Entfernen"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <div className="min-w-0 flex-1 truncate text-sm text-slate-100">
                            {p.label || "Neue Position"}
                          </div>
                          <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400">
                            {ASSET_CLASS_LABEL[p.assetClass] || "–"}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-slate-200">
                            {(p.amountChf ?? 0).toLocaleString("de-CH")}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`shrink-0 text-slate-500 transition-transform ${expandedIds.has(p.id) ? "rotate-180" : ""}`}
                          />
                        </div>
                        {expandedIds.has(p.id) && (
                        <div className="border-t border-slate-800/60 px-3 pb-3 pt-2">
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

                          <CustomSelect
                            label="Typ"
                            options={ASSET_CLASS_OPTIONS.map((o) => ({ value: o.v, label: o.l }))}
                            value={p.assetClass}
                            onChange={(v) => upsert(p.id, { assetClass: v as AssetClass })}
                            placeholder="Typ wählen…"
                          />

                          <FieldMoneyInt
                            label="Wert"
                            valueChf={p.amountChf}
                            onChangeChf={(n) => upsert(p.id, { amountChf: n })}
                          />

                          <CustomSelect
                            label="Verfügbarkeit"
                            options={AVAILABILITY_OPTIONS.map((o) => ({ value: o.v, label: o.l }))}
                            value={p.availability}
                            onChange={(v) => upsert(p.id, { availability: v as Availability })}
                            placeholder="Verfügbarkeit…"
                          />

                          <FieldMoneyInt
                            label="Ertrag p.a."
                            valueChf={p.cashflowPa}
                            onChangeChf={(n) => upsert(p.id, { cashflowPa: n })}
                          />

                          <CustomSelect
                            label="Ziel"
                            options={[
                              { value: "liq", label: "Liquidität" },
                              { value: "reinvest", label: "Wiederanlage" },
                            ]}
                            value={p.goal}
                            onChange={(v) => upsert(p.id, { goal: v as Goal })}
                            placeholder="Ziel…"
                          />

                          {hasCashflow(p) && (
                            <div>
                              <CustomSelect
                                label="Gegenkonto"
                                options={[
                                  { value: "", label: "Gegenkonto wählen…" },
                                  ...counterOptionsFor(p).map((o) => ({
                                    value: o.key,
                                    label: o.label + (o.key === makeKey("asset", p.id) ? " (intern)" : ""),
                                  })),
                                ]}
                                value={p.targetAccountKey ?? ""}
                                onChange={(v) => upsert(p.id, { targetAccountKey: v || undefined })}
                                placeholder="Gegenkonto wählen…"
                              />
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
                        </div>
                        </div>
                        )}
                      </div>
                    );
                  })}

                  {activeItems.length === 0 && (
                    <div className="py-6 text-center text-slate-500">
                      Keine Positionen in {BUCKET_META[activeBucket].title}.
                    </div>
                  )}
                </div>

                {/* Desktop: Table (nur ab lg) */}
                <div className="hidden lg:block overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="py-2 w-10"> </th>
                        <th className="text-left py-2 px-3">Bezeichnung</th>
                        <th className="text-left py-2 px-3 w-[15%]">Typ</th>
                        <th className="text-left py-2 px-3 w-[14%]">Wert</th>
                        <th className="text-left py-2 px-3 w-[14%]">Verf.</th>
                        <th className="py-2 w-10"> </th>
                      </tr>
                    </thead>

                    {activeItems.map((p) => {
                      const err = counterError(p);
                      const isExp = expandedIds.has(p.id);

                      return (
                        <tbody
                          key={p.id}
                          onBlur={(e) => {
                            const next = e.relatedTarget as Node | null;
                            if (next && e.currentTarget.contains(next)) return;
                            void commitIfDirty(p.id);
                          }}
                        >
                          <tr className="border-b border-slate-900">
                            <td className="py-2 pr-1">
                              {!p.isSystem ? (
                                <button
                                  type="button"
                                  onClick={() => removePosition(p.id)}
                                  className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-300 hover:border-slate-700 hover:text-slate-100 transition"
                                  title="Entfernen"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </td>

                            <td className="py-2 px-3">
                              <input
                                value={p.label}
                                onChange={(e) => upsert(p.id, { label: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                              />
                            </td>

                            <td className="py-2 px-3">
                              <CustomSelect
                                options={ASSET_CLASS_OPTIONS.map((o) => ({ value: o.v, label: o.l }))}
                                value={p.assetClass}
                                onChange={(v) => upsert(p.id, { assetClass: v as AssetClass })}
                                placeholder="Typ…"
                              />
                            </td>

                            <td className="py-2 px-3">
                              <FieldMoneyInt
                                label=""
                                valueChf={p.amountChf}
                                onChangeChf={(n) => upsert(p.id, { amountChf: n })}
                              />
                            </td>

                            <td className="py-2 px-3">
                              <CustomSelect
                                options={AVAILABILITY_OPTIONS.map((o) => ({ value: o.v, label: o.l }))}
                                value={p.availability}
                                onChange={(v) => upsert(p.id, { availability: v as Availability })}
                                placeholder="Verf.…"
                              />
                            </td>

                            <td className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpand(p.id)}
                                className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-100 transition"
                                title={isExp ? "Zuklappen" : "Details"}
                              >
                                <ChevronDown
                                  size={16}
                                  className={`transition-transform ${isExp ? "rotate-180" : ""}`}
                                />
                              </button>
                            </td>
                          </tr>

                          {isExp && (
                            <tr className="border-b border-slate-800/50 bg-slate-950/40">
                              <td />
                              <td colSpan={5} className="px-3 pb-3 pt-2">
                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                                  <FieldMoneyInt
                                    label="Ertrag p.a."
                                    valueChf={p.cashflowPa}
                                    onChangeChf={(n) => upsert(p.id, { cashflowPa: n })}
                                  />

                                  <CustomSelect
                                    label="Ziel"
                                    options={[
                                      { value: "liq", label: "Liquidität" },
                                      { value: "reinvest", label: "Wiederanlage" },
                                    ]}
                                    value={p.goal}
                                    onChange={(v) => upsert(p.id, { goal: v as Goal })}
                                    placeholder="Ziel…"
                                  />

                                  {hasCashflow(p) ? (
                                    <div>
                                      <CustomSelect
                                        label="Gegenkonto"
                                        options={[
                                          { value: "", label: "Gegenkonto wählen…" },
                                          ...counterOptionsFor(p).map((o) => ({
                                            value: o.key,
                                            label: o.label + (o.key === makeKey("asset", p.id) ? " (intern)" : ""),
                                          })),
                                        ]}
                                        value={p.targetAccountKey ?? ""}
                                        onChange={(v) => upsert(p.id, { targetAccountKey: v || undefined })}
                                        placeholder="Gegenkonto wählen…"
                                      />
                                      {err && <div className="mt-1 text-xs text-amber-400/90">{err}</div>}
                                    </div>
                                  ) : (
                                    <div />
                                  )}

                                  <div>
                                    <label className="mb-1 block text-xs text-slate-400">Notiz</label>
                                    <input
                                      value={p.notes ?? ""}
                                      onChange={(e) => upsert(p.id, { notes: e.target.value })}
                                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                                      placeholder="optional"
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      );
                    })}

                    {activeItems.length === 0 && (
                      <tbody>
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            Keine Positionen in {BUCKET_META[activeBucket].title}.
                          </td>
                        </tr>
                      </tbody>
                    )}
                  </table>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Regeln: Ziel=Liquidität → LIQ-Konto (nicht identisch). Ziel=Wiederanlage → intern (identisch) oder Nicht-LIQ-Konto.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
