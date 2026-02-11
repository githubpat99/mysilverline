"use client";

import { useEffect, useMemo, useState } from "react";
import ForecastChartSummary from "./ForecastChartSummary";

export type Buckets = {
  liq: number;
  shortA: number;
  longA: number;
  realA: number;
  shortD?: number;
  longD?: number;
};

export type YearRow = {
  year: number;

  // End-of-year buckets (aus computeForecast)
  liq: number;
  shortA: number;
  longA: number;
  realA: number;
  shortD?: number;
  longD?: number;

  // optional: falls engine später start explizit liefert
  start?: Buckets;

  // optional Erklärungsfelder (können später kommen)
  netFlow?: number;
  assetCF?: number;
  events?: number;

  // optional movement/detail fields (if present, we show them)
  assetCashflowToLiq?: number;
  assetCashflowReinvest?: number;
  assetCashflowReinvestBreakdown?: { shortA: number; longA: number; realA: number };
  debtInterest?: number;
  debtAmort?: number;

  // NEW: explizite Tilgungsquelle (Transfer: Assets -> Debts)
  transferAmortFrom?: {
    liq: number;
    shortA: number;
    longA: number;
    realA: number;
  };

  // optional: wenn du Rebalancing/Defizitdeckung separat ausweisen willst
  coverDeficitFrom?: {
    shortA: number;
    longA: number;
    realA: number;
  };
  transferInterestFrom?: {
    liq: number;
    shortA: number;
    longA: number;
    realA: number
  };

  /** Phase 4: Überzug erhöht (wenn Liquidität nicht reichte) */
  overdraftAdded?: number;
  /** Phase 5: Quelle pro Instrument (id → CHF) */
  transferInterestFromByInstrument?: Record<string, number>;
  transferAmortFromByInstrument?: Record<string, number>;
};

// ---------------- helpers ----------------
function n(x: any): number {
  const v = typeof x === "number" && Number.isFinite(x) ? x : 0;
  return v;
}

function formatCHF(v: number) {
  return Math.trunc(n(v)).toLocaleString("de-CH");
}

function sum(...xs: number[]) {
  return xs.reduce((a, b) => a + n(b), 0);
}

function netWorth(b: Buckets) {
  const assets = sum(b.liq, b.shortA, b.longA, b.realA);
  const debts = sum(b.shortD ?? 0, b.longD ?? 0);
  return { assets, debts, net: assets - debts };
}

function endBucketsOf(r: YearRow): Buckets {
  return {
    liq: n(r.liq),
    shortA: n(r.shortA),
    longA: n(r.longA),
    realA: n(r.realA),
    shortD: r.shortD == null ? undefined : n(r.shortD),
    longD: r.longD == null ? undefined : n(r.longD),
  };
}

function fmtDelta(v: number) {
  const x = Math.trunc(n(v));
  if (x === 0) return "0";
  return x > 0 ? `+${formatCHF(x)}` : `-${formatCHF(Math.abs(x))}`;
}

// ---------------- mobile stacked row ----------------
function MobileRow({
  label,
  start,
  end,
  delta,
  bold,
  indent,
  deltaMode,
}: {
  label: string;
  start: number;
  end: number;
  delta: number;
  bold?: boolean;
  indent?: boolean;
  deltaMode?: "asset" | "debt" | "neutral"; // debt: negative delta is good
}) {
  const titleCls = [
    indent ? "pl-3" : "",
    bold ? "text-slate-50 font-semibold" : "text-slate-200",
  ].join(" ");

  const mode = deltaMode ?? "asset";
  const isGood =
    mode === "neutral" ? null : mode === "debt" ? delta <= 0 : delta >= 0;

  const deltaCls =
    isGood == null ? "text-slate-100" : isGood ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="py-2 border-b border-slate-800/60 last:border-b-0">
      <div className={titleCls}>{label}</div>

      <div className={`${indent ? "pl-3" : ""} mt-1 grid grid-cols-3 gap-2 text-xs`}>
        <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
          <div className="text-slate-400">Start</div>
          <div className="text-slate-50 tabular-nums mt-1">{formatCHF(start)}</div>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
          <div className="text-slate-400">Ende</div>
          <div className="text-slate-50 tabular-nums mt-1">{formatCHF(end)}</div>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
          <div className="text-slate-400">Δ</div>
          <div className={`tabular-nums mt-1 ${deltaCls}`}>{fmtDelta(delta)}</div>
        </div>
      </div>
    </div>
  );
}

export default function ForecastTableNice({
  rows = [],
  positions = [],
}: {
  rows?: YearRow[];
  positions?: Array<{ id?: string; instrument_id?: string; label?: string }>;
}) {
  const safeRows = rows ?? [];

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[ForecastTableNice] rows length =", safeRows.length, safeRows[0]);
  }, [safeRows.length]);

  const computed = useMemo(() => {
    return safeRows.map((r, i) => {
      const end = endBucketsOf(r);

      // Start: Priorität 1: r.start, sonst Ende Vorjahr, sonst Ende dieses Jahres (nur fürs erste Jahr fallback)
      const start: Buckets = r.start ?? (i > 0 ? endBucketsOf(safeRows[i - 1]) : end);

      const sNW = netWorth(start);
      const eNW = netWorth(end);

      const deltaBuckets: Buckets = {
        liq: end.liq - start.liq,
        shortA: end.shortA - start.shortA,
        longA: end.longA - start.longA,
        realA: end.realA - start.realA,
        shortD: (end.shortD ?? 0) - (start.shortD ?? 0),
        longD: (end.longD ?? 0) - (start.longD ?? 0),
      };

      const deltaNet = eNW.net - sNW.net;

      return {
        ...r,
        _start: start,
        _end: end,
        _startNW: sNW,
        _endNW: eNW,
        _deltaBuckets: deltaBuckets,
        _deltaNet: deltaNet,
      };
    });
  }, [safeRows]);

  const [openYears, setOpenYears] = useState<Set<number>>(() => new Set());

  function toggleYear(y: number) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  }

  // helpers in ForecastTableNice.tsx (oben im component scope)
  function inferAmortSourceLabel(deltaBuckets: Buckets) {
    // Heuristik: first bucket with clear negative delta
    // (Engine zieht bei Bedarf in dieser Reihenfolge: LIQ -> ST -> LT -> REAL)
    if (n(deltaBuckets.liq) < 0) return "aus LIQ";
    if (n(deltaBuckets.shortA) < 0) return "aus ST";
    if (n(deltaBuckets.longA) < 0) return "aus LT";
    if (n(deltaBuckets.realA) < 0) return "aus REAL";
    return "";
  }

  /** Sheet-Format: "LIQ 350, Kurzfr. 650" (Bucket-Split wie im Excel) */
  function splitLabelFromSrc(src?: { liq: number; shortA: number; longA: number; realA: number }) {
    if (!src) return "";
    const parts = [
      { label: "LIQ", amount: Math.trunc(n(src.liq)) },
      { label: "Kurzfr.", amount: Math.trunc(n(src.shortA)) },
      { label: "Langfr.", amount: Math.trunc(n(src.longA)) },
      { label: "Sachw.", amount: Math.trunc(n(src.realA)) },
    ].filter(x => x.amount !== 0);
    return parts.length ? parts.map(x => `${x.label} ${formatCHF(x.amount)}`).join(", ") : "";
  }

  return (
    <div className="space-y-4">
      <ForecastChartSummary rows={safeRows} />

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        {/* Header (nur Desktop/Tablet) */}
        <div className="px-4 py-3 border-b border-slate-800 hidden sm:block">
          <div className="grid grid-cols-5 gap-2 text-xs uppercase tracking-wide text-slate-400">
            <div>Jahr</div>
            <div className="text-right">Aktiven</div>
            <div className="text-right">Passiven</div>
            <div className="text-right">Eigenkapital Ende</div>
            <div className="text-right">Δ Eigenkapital</div>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-800">
          {computed.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400">Keine Forecast-Daten vorhanden.</div>
          ) : (
            computed.map((r: any, idx: number) => {
              const isOpen = openYears.has(r.year);
              const startYear = idx > 0 ? computed[idx - 1].year : r.year;
              const endYear = r.year;

              const Row = ({
                label,
                start,
                end,
                delta,
                bold,
                indent,
                deltaMode,
              }: {
                label: string;
                start: number;
                end: number;
                delta: number;
                bold?: boolean;
                indent?: boolean;
                deltaMode?: "asset" | "debt" | "neutral";
              }) => {
                const lCls = [
                  indent ? "pl-4" : "",
                  bold ? "text-slate-50 font-semibold" : "text-slate-200",
                ].join(" ");
                const vCls = bold
                  ? "text-slate-50 font-semibold tabular-nums text-right"
                  : "text-slate-50 tabular-nums text-right";

                const mode = deltaMode ?? "asset";
                const isGood =
                  mode === "neutral" ? null : mode === "debt" ? (delta ?? 0) <= 0 : (delta ?? 0) >= 0;

                const dCls =
                  isGood == null
                    ? bold
                      ? "text-slate-100 font-semibold tabular-nums text-right"
                      : "text-slate-100 tabular-nums text-right"
                    : isGood
                      ? bold
                        ? "text-emerald-300 font-semibold tabular-nums text-right"
                        : "text-emerald-300 tabular-nums text-right"
                      : bold
                        ? "text-rose-300 font-semibold tabular-nums text-right"
                        : "text-rose-300 tabular-nums text-right";

                return (
                  <div className="grid grid-cols-4 gap-2 py-1">
                    <div className={lCls}>{label}</div>
                    <div className={vCls}>{formatCHF(start)}</div>
                    <div className={vCls}>{formatCHF(end)}</div>
                    <div className={dCls}>{fmtDelta(delta)}</div>
                  </div>
                );
              };

              const MovementLine = ({
                label,
                value,
                kind,
              }: {
                label: string;
                value: number;
                kind: "pos" | "neg" | "neutral";
              }) => {
                const v = Math.trunc(n(value));
                if (v === 0) return null;

                const shown =
                  kind === "pos"
                    ? `+${formatCHF(v)}`
                    : kind === "neg"
                      ? `-${formatCHF(Math.abs(v))}`
                      : `${formatCHF(v)}`;

                const cls =
                  kind === "pos"
                    ? "text-emerald-300 tabular-nums"
                    : kind === "neg"
                      ? "text-rose-300 tabular-nums"
                      : "text-slate-50 tabular-nums";

                return (
                  <div className="flex items-center justify-between py-1">
                    <div className="text-slate-200">{label}</div>
                    <div className={cls}>{shown}</div>
                  </div>
                );
              };

              const showMovements =
                n(r.assetCashflowToLiq) !== 0 ||
                n(r.assetCashflowReinvest) !== 0 ||
                n(r.debtInterest) !== 0 ||
                n(r.debtAmort) !== 0;

              return (
                <div key={r.year}>
                  <button
                    type="button"
                    onClick={() => toggleYear(r.year)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-900/40 transition"
                    aria-expanded={isOpen}
                  >
                    {/* DESKTOP/TABLET */}
                    <div className="hidden sm:grid grid-cols-5 gap-2 items-center">
                      <div className="text-slate-50 font-medium">{r.year}</div>
                      <div className="text-right text-slate-50 tabular-nums">{formatCHF(r._endNW.assets)}</div>
                      <div className="text-right text-slate-50 tabular-nums">{formatCHF(r._endNW.debts)}</div>
                      <div className="text-right text-slate-50 tabular-nums">{formatCHF(r._endNW.net)}</div>
                      <div className="text-right tabular-nums">
                        <span className={r._deltaNet >= 0 ? "text-emerald-300" : "text-rose-300"}>
                          {fmtDelta(r._deltaNet)}
                        </span>
                      </div>
                    </div>

                    {/* MOBILE */}
                    <div className="sm:hidden">
                      <div className="flex items-baseline justify-between">
                        <div className="text-slate-50 font-semibold">{r.year}</div>
                        <div className="tabular-nums">
                          <span className="text-xs text-slate-400 mr-2">Eigenkapital</span>
                          <span className="text-slate-50 font-semibold">{formatCHF(r._endNW.net)}</span>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                          <div className="text-slate-400">Aktiven</div>
                          <div className="text-slate-50 tabular-nums mt-1">{formatCHF(r._endNW.assets)}</div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                          <div className="text-slate-400">Passiven</div>
                          <div className="text-slate-50 tabular-nums mt-1">{formatCHF(r._endNW.debts)}</div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                          <div className="text-slate-400">Δ Eigenkapital</div>
                          <div className={`tabular-nums mt-1 ${r._deltaNet >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {fmtDelta(r._deltaNet)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-400">Tippen/Klicken für Details</div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        {/* ---------------- helpers (lokal im Render ok, oder oben im file) ---------------- */}
                        {/*
                          Tilgung ist Transfer: Schulden sinken (good), aber Finanzierung kommt aus Asset-Buckets.
                          Wir inferieren “Quelle” aus den NEGATIVEN Asset-Deltas des Jahres.
                        */}
                        {(() => {
                          const amort = Math.max(0, Math.trunc(n(r.debtAmort)));

                          // 1) bevorzugt: echte Quelle aus Engine
                          const src = r.transferAmortFrom;

                          let split: { label: string; amount: number }[] = [];

                          if (src) {
                            split = [
                              { label: "LIQ", amount: Math.trunc(n(src.liq)) },
                              { label: "Kurzfr.", amount: Math.trunc(n(src.shortA)) },
                              { label: "Langfr.", amount: Math.trunc(n(src.longA)) },
                              { label: "Sachw.", amount: Math.trunc(n(src.realA)) },
                            ].filter((x) => x.amount !== 0);
                          } else {
                            // 2) Fallback: alte Heuristik (nur solange alte Rows existieren)
                            const d = r._deltaBuckets as Buckets;

                            const sources = [
                              { label: "LIQ", out: Math.max(0, -Math.trunc(n(d.liq))) },
                              { label: "ST", out: Math.max(0, -Math.trunc(n(d.shortA))) },
                              { label: "LT", out: Math.max(0, -Math.trunc(n(d.longA))) },
                              { label: "REAL", out: Math.max(0, -Math.trunc(n(d.realA))) },
                            ].filter((s) => s.out > 0);

                            let remain = amort;
                            for (const s of sources) {
                              if (remain <= 0) break;
                              const take = Math.min(s.out, remain);
                              if (take > 0) split.push({ label: s.label, amount: take });
                              remain -= take;
                            }
                          }
                          const splitLabel = split.length > 0 ? split.map((x) => `${x.label} ${formatCHF(x.amount)}`).join(", ") : "";
                          const interestSrcLabel = splitLabelFromSrc(r.transferInterestFrom);
                          const overdraftAdded = Math.trunc(n((r as any).overdraftAdded));
                          const showMovements =
                            n(r.assetCashflowToLiq) !== 0 ||
                            n(r.assetCashflowReinvest) !== 0 ||
                            n(r.debtInterest) !== 0 ||
                            amort !== 0 ||
                            overdraftAdded !== 0;

                          return (
                            <>
                              {/* DESKTOP/TABLET */}
                              <div className="hidden sm:block">
                                <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 overflow-hidden">
                                  <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                                    <div />
                                    <div className="text-right">Start {startYear}</div>
                                    <div className="text-right">Ende {endYear}</div>
                                    <div className="text-right">Δ Eigenkapital</div>
                                  </div>

                                  <div className="px-3 py-2">
                                    {/* Aktiven (mit Details direkt darunter) */}
                                    <Row
                                      label="Aktiven"
                                      start={r._startNW.assets}
                                      end={r._endNW.assets}
                                      delta={r._endNW.assets - r._startNW.assets}
                                      bold
                                    />
                                    <Row label="Liquidität" start={r._start.liq} end={r._end.liq} delta={r._deltaBuckets.liq} indent />
                                    <Row label="Kurzfristig" start={r._start.shortA} end={r._end.shortA} delta={r._deltaBuckets.shortA} indent />
                                    <Row label="Langfristig" start={r._start.longA} end={r._end.longA} delta={r._deltaBuckets.longA} indent />
                                    <Row label="Sachwerte" start={r._start.realA} end={r._end.realA} delta={r._deltaBuckets.realA} indent />

                                    <div className="my-3 border-t border-slate-800" />

                                    {/* Passiven (mit Details direkt darunter) */}
                                    <Row
                                      label="Passiven"
                                      start={r._startNW.debts}
                                      end={r._endNW.debts}
                                      delta={r._endNW.debts - r._startNW.debts}
                                      bold
                                      deltaMode="debt"
                                    />
                                    <Row
                                      label="Kurzfristige Schulden"
                                      start={r._start.shortD ?? 0}
                                      end={r._end.shortD ?? 0}
                                      delta={r._deltaBuckets.shortD ?? 0}
                                      indent
                                      deltaMode="debt"
                                    />
                                    <Row
                                      label="Langfristige Schulden"
                                      start={r._start.longD ?? 0}
                                      end={r._end.longD ?? 0}
                                      delta={r._deltaBuckets.longD ?? 0}
                                      indent
                                      deltaMode="debt"
                                    />

                                    <div className="my-3 border-t border-slate-800" />

                                    {/* Eigenkapital */}
                                    <Row label="Eigenkapital" start={r._startNW.net} end={r._endNW.net} delta={r._deltaNet} bold />

                                    {showMovements && (
                                      <>
                                        <div className="my-3 border-t border-slate-800" />

                                        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                          →  Eigenkapitalveränderung
                                        </div>

                                        {/* Cashflow + Zinsen erklären Eigenkapitalveränderung */}
                                        <MovementLine label="Cashflow → Liquidität" value={n(r.assetCashflowToLiq)} kind="pos" />
                                        <MovementLine label="Cashflow → ReInvest" value={n(r.assetCashflowReinvest)} kind="pos" />
                                        <MovementLine label="Zinsen" value={n(r.debtInterest)} kind="neg" />
                                        {interestSrcLabel && (
                                          <div className="mt-1 text-xs text-slate-400">
                                            Quelle: {interestSrcLabel}
                                          </div>
                                        )}

                                        {/* dünne Linie vor Tilgung */}
                                        {amort !== 0 && <div className="my-2 border-t border-slate-800/60" />}

                                        {/* Tilgung als Transfer + Split */}
                                        {amort !== 0 && (
                                          <>
                                            <MovementLine
                                              label="Tilgung (Transfer)"
                                              value={amort}
                                              kind="neutral"
                                            />
                                            {(splitLabel || splitLabelFromSrc(r.transferAmortFrom)) && (
                                              <div className="mt-1 text-xs text-slate-400">
                                                Quelle: {splitLabel || splitLabelFromSrc(r.transferAmortFrom)}
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {overdraftAdded > 0 && (
                                          <div className="mt-1 text-xs text-amber-400/90">
                                            Überzug erhöht: +{formatCHF(overdraftAdded)}
                                          </div>
                                        )}

                                        {/* Herleitung Aktiven: erklärt Δ pro Bucket */}
                                        {(() => {
                                          const breakdown = r.assetCashflowReinvestBreakdown;
                                          const intFrom = r.transferInterestFrom;
                                          const amortFrom = r.transferAmortFrom;
                                          const coverFrom = r.coverDeficitFrom;
                                          const hasLiqFlow =
                                            (intFrom && n(intFrom.liq) !== 0) ||
                                            (amortFrom && n(amortFrom.liq) !== 0);
                                          const hasShortFlow =
                                            (breakdown && n(breakdown.shortA) !== 0) ||
                                            (intFrom && n(intFrom.shortA) !== 0) ||
                                            (amortFrom && n(amortFrom.shortA) !== 0) ||
                                            (coverFrom && n(coverFrom.shortA) !== 0);
                                          const hasLongFlow =
                                            (breakdown && n(breakdown.longA) !== 0) ||
                                            (intFrom && n(intFrom.longA) !== 0) ||
                                            (amortFrom && n(amortFrom.longA) !== 0) ||
                                            (coverFrom && n(coverFrom.longA) !== 0);
                                          const hasRealFlow =
                                            (breakdown && n(breakdown.realA) !== 0) ||
                                            (intFrom && n(intFrom.realA) !== 0) ||
                                            (amortFrom && n(amortFrom.realA) !== 0) ||
                                            (coverFrom && n(coverFrom.realA) !== 0);

                                          if (!hasLiqFlow && !hasShortFlow && !hasLongFlow && !hasRealFlow) return null;

                                          const line = (
                                            label: string,
                                            delta: number,
                                            items: { label: string; val: number; sign: "+" | "-" }[],
                                          ) => {
                                            const nonZero = items.filter((x) => x.val !== 0);
                                            if (nonZero.length === 0) return null;
                                            const parts = nonZero
                                              .map((x) => `${x.sign}${formatCHF(x.val)} ${x.label}`)
                                              .join(", ");
                                            return (
                                              <div
                                                key={label}
                                                className="mt-2 flex flex-wrap items-baseline gap-x-1 text-xs"
                                              >
                                                <span className="text-slate-400 shrink-0">{label} ({fmtDelta(delta)}):</span>
                                                <span className="text-slate-300">{parts}</span>
                                              </div>
                                            );
                                          };

                                          return (
                                            <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/30 px-3 py-2">
                                              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                                                Herleitung Aktiven
                                              </div>
                                              {hasLiqFlow &&
                                                line("Liquidität", r._deltaBuckets.liq, [
                                                  {
                                                    label: "Zinsen",
                                                    val: Math.trunc(n(intFrom?.liq)),
                                                    sign: "-",
                                                  },
                                                  {
                                                    label: "Tilgung",
                                                    val: Math.trunc(n(amortFrom?.liq)),
                                                    sign: "-",
                                                  },
                                                ])}
                                              {hasShortFlow &&
                                                line("Kurzfristig", r._deltaBuckets.shortA, [
                                                  {
                                                    label: "Cashflow Reinvest",
                                                    val: Math.trunc(n(breakdown?.shortA)),
                                                    sign: "+",
                                                  },
                                                  {
                                                    label: "Zinsen",
                                                    val: Math.trunc(n(intFrom?.shortA)),
                                                    sign: "-",
                                                  },
                                                  {
                                                    label: "Tilgung",
                                                    val: Math.trunc(n(amortFrom?.shortA)),
                                                    sign: "-",
                                                  },
                                                  {
                                                    label: "Defizitdeckung",
                                                    val: Math.trunc(n(coverFrom?.shortA)),
                                                    sign: "-",
                                                  },
                                                ])}
                                              {hasLongFlow &&
                                                line("Langfristig", r._deltaBuckets.longA, [
                                                  {
                                                    label: "Cashflow Reinvest",
                                                    val: Math.trunc(n(breakdown?.longA)),
                                                    sign: "+",
                                                  },
                                                  {
                                                    label: "Zinsen",
                                                    val: Math.trunc(n(intFrom?.longA)),
                                                    sign: "-",
                                                  },
                                                  {
                                                    label: "Tilgung",
                                                    val: Math.trunc(n(amortFrom?.longA)),
                                                    sign: "-",
                                                  },
                                                  {
                                                    label: "Defizitdeckung",
                                                    val: Math.trunc(n(coverFrom?.longA)),
                                                    sign: "-",
                                                  },
                                                ])}
                                              {hasRealFlow &&
                                                line("Sachwerte", r._deltaBuckets.realA, [
                                                  {
                                                    label: "Cashflow Reinvest",
                                                    val: Math.trunc(n(breakdown?.realA)),
                                                    sign: "+",
                                                  },
                                                  {
                                                    label: "Zinsen",
                                                    val: Math.trunc(n(intFrom?.realA)),
                                                    sign: "-",
                                                  },
                                                  {
                                                    label: "Tilgung",
                                                    val: Math.trunc(n(amortFrom?.realA)),
                                                    sign: "-",
                                                  },
                                                  {
                                                    label: "Defizitdeckung",
                                                    val: Math.trunc(n(coverFrom?.realA)),
                                                    sign: "-",
                                                  },
                                                ])}
                                              <div className="mt-2 text-[10px] text-slate-500">
                                                Summe der Bewegungen kann von Δ abweichen (Rendite, Rundung).
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* MOBILE */}
                              <div className="sm:hidden">
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">


                                  {/* Aktiven + Details */}
                                  <MobileRow
                                    label="Aktiven"
                                    start={r._startNW.assets}
                                    end={r._endNW.assets}
                                    delta={r._endNW.assets - r._startNW.assets}
                                    bold
                                    deltaMode="asset"
                                  />
                                  <MobileRow label="Liquidität" start={r._start.liq} end={r._end.liq} delta={r._deltaBuckets.liq} indent deltaMode="asset" />
                                  <MobileRow label="Kurzfristig" start={r._start.shortA} end={r._end.shortA} delta={r._deltaBuckets.shortA} indent deltaMode="asset" />
                                  <MobileRow label="Langfristig" start={r._start.longA} end={r._end.longA} delta={r._deltaBuckets.longA} indent deltaMode="asset" />
                                  <MobileRow label="Sachwerte" start={r._start.realA} end={r._end.realA} delta={r._deltaBuckets.realA} indent deltaMode="asset" />

                                  {/* Passiven + Details */}
                                  <MobileRow
                                    label="Passiven"
                                    start={r._startNW.debts}
                                    end={r._endNW.debts}
                                    delta={r._endNW.debts - r._startNW.debts}
                                    bold
                                    deltaMode="debt"
                                  />
                                  <MobileRow
                                    label="Kurzfristige Schulden"
                                    start={r._start.shortD ?? 0}
                                    end={r._end.shortD ?? 0}
                                    delta={r._deltaBuckets.shortD ?? 0}
                                    indent
                                    deltaMode="debt"
                                  />
                                  <MobileRow
                                    label="Langfristige Schulden"
                                    start={r._start.longD ?? 0}
                                    end={r._end.longD ?? 0}
                                    delta={r._deltaBuckets.longD ?? 0}
                                    indent
                                    deltaMode="debt"
                                  />

                                  {/* Eigenkapital */}
                                  <MobileRow
                                    label="Eigenkapital"
                                    start={r._startNW.net}
                                    end={r._endNW.net}
                                    delta={r._deltaNet}
                                    bold
                                    deltaMode="asset"
                                  />

                                  {showMovements && (
                                    <>
                                      <div className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                                        →  Eigenkapitalveränderung
                                      </div>

                                      {n(r.assetCashflowToLiq) !== 0 && (
                                        <div className="flex items-center justify-between py-1">
                                          <div className="text-slate-200">Cashflow → Liquidität</div>
                                          <div className="text-emerald-300 tabular-nums">+{formatCHF(n(r.assetCashflowToLiq))}</div>
                                        </div>
                                      )}
                                      {n(r.assetCashflowReinvest) !== 0 && (
                                        <div className="flex items-center justify-between py-1">
                                          <div className="text-slate-200">Cashflow → ReInvest</div>
                                          <div className="text-emerald-300 tabular-nums">+{formatCHF(n(r.assetCashflowReinvest))}</div>
                                        </div>
                                      )}
                                      {n(r.debtInterest) !== 0 && (
                                        <>
                                          <div className="flex items-center justify-between py-1">
                                            <div className="text-slate-200">Zinsen</div>
                                            <div className="text-rose-300 tabular-nums">
                                              -{formatCHF(Math.abs(n(r.debtInterest)))}
                                            </div>
                                          </div>

                                          {splitLabelFromSrc(r.transferInterestFrom) && (
                                            <div className="pl-2 text-xs text-slate-400">
                                              Quelle: {splitLabelFromSrc(r.transferInterestFrom)}
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {amort !== 0 && <div className="my-2 border-t border-slate-800/60" />}

                                      {amort !== 0 && (
                                        <>
                                          <div className="flex items-center justify-between py-1">
                                            <div className="text-slate-200">Tilgung (Transfer)</div>
                                            <div className="text-slate-200 tabular-nums">{formatCHF(amort)}</div>
                                          </div>

                                          {(splitLabel || splitLabelFromSrc(r.transferAmortFrom)) && (
                                            <div className="mt-1 text-xs text-slate-400">
                                              Quelle: {splitLabel || splitLabelFromSrc(r.transferAmortFrom)}
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {overdraftAdded > 0 && (
                                        <div className="mt-2 text-xs text-amber-400/90">
                                          Überzug erhöht: +{formatCHF(overdraftAdded)}
                                        </div>
                                      )}

                                      {/* Herleitung Aktiven (Mobile) */}
                                      {(() => {
                                        const breakdown = r.assetCashflowReinvestBreakdown;
                                        const intFrom = r.transferInterestFrom;
                                        const amortFrom = r.transferAmortFrom;
                                        const coverFrom = r.coverDeficitFrom;
                                        const hasAny =
                                          (intFrom && (n(intFrom.liq) !== 0 || n(intFrom.shortA) !== 0)) ||
                                          (amortFrom && (n(amortFrom.liq) !== 0 || n(amortFrom.shortA) !== 0)) ||
                                          (breakdown && n(breakdown.shortA) !== 0) ||
                                          (coverFrom && n(coverFrom.shortA) !== 0);
                                        if (!hasAny) return null;
                                        const liqParts: string[] = [];
                                        if (n(intFrom?.liq)) liqParts.push(`−${formatCHF(n(intFrom.liq))} Zinsen`);
                                        if (n(amortFrom?.liq)) liqParts.push(`−${formatCHF(n(amortFrom.liq))} Tilgung`);
                                        const shortParts: string[] = [];
                                        if (n(breakdown?.shortA)) shortParts.push(`+${formatCHF(n(breakdown.shortA))} Reinvest`);
                                        if (n(intFrom?.shortA)) shortParts.push(`−${formatCHF(n(intFrom.shortA))} Zinsen`);
                                        if (n(amortFrom?.shortA)) shortParts.push(`−${formatCHF(n(amortFrom.shortA))} Tilgung`);
                                        if (n(coverFrom?.shortA)) shortParts.push(`−${formatCHF(n(coverFrom.shortA))} Defizitdeckung`);
                                        return (
                                          <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/30 p-2">
                                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                                              Herleitung Aktiven
                                            </div>
                                            {liqParts.length > 0 && (
                                              <div className="text-xs text-slate-300">
                                                Liquidität ({fmtDelta(r._deltaBuckets.liq)}): {liqParts.join(", ")}
                                              </div>
                                            )}
                                            {shortParts.length > 0 && (
                                              <div className="mt-1 text-xs text-slate-300">
                                                Kurzfristig ({fmtDelta(r._deltaBuckets.shortA)}): {shortParts.join(", ")}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 text-xs text-slate-500">
                                Cashflow und Zinsen erklären die Eigenkapitalveränderung. Tilgung ist ein Transfer (Aktiven ↓, Schulden ↓); Quellen werden aus den angegebenen Gegenkonten ermittelt. Wenn Liquidität nicht reicht, steigt der Überzug.
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}