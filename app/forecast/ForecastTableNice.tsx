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

// ---------------- mobile stacked row ----------------
function MobileRow({
  label,
  start,
  end,
  delta,
  bold,
  indent,
}: {
  label: string;
  start: number;
  end: number;
  delta: number;
  bold?: boolean;
  indent?: boolean;
}) {
  const titleCls = [
    indent ? "pl-3" : "",
    bold ? "text-slate-50 font-semibold" : "text-slate-200",
  ].join(" ");

  const deltaCls = delta >= 0 ? "text-emerald-300" : "text-rose-300";

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
          <div className={`tabular-nums mt-1 ${deltaCls}`}>{formatCHF(delta)}</div>
        </div>
      </div>
    </div>
  );
}

export default function ForecastTableNice({ rows = [] }: { rows?: YearRow[] }) {
  const safeRows = rows ?? [];

  // DEBUG: wenn alles leer ist, liegt es meistens daran, dass rows gar nicht ankommt
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
            <div className="text-right">Netto Ende</div>
            <div className="text-right">Δ Netto</div>
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
              }: {
                label: string;
                start: number;
                end: number;
                delta: number;
                bold?: boolean;
                indent?: boolean;
              }) => {
                const lCls = [
                  indent ? "pl-4" : "",
                  bold ? "text-slate-50 font-semibold" : "text-slate-200",
                ].join(" ");
                const vCls = bold
                  ? "text-slate-50 font-semibold tabular-nums text-right"
                  : "text-slate-50 tabular-nums text-right";
                const dCls =
                  (delta ?? 0) >= 0
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
                    <div className={dCls}>{formatCHF(delta)}</div>
                  </div>
                );
              };

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
                          {formatCHF(r._deltaNet)}
                        </span>
                      </div>
                    </div>

                    {/* MOBILE */}
                    <div className="sm:hidden">
                      <div className="flex items-baseline justify-between">
                        <div className="text-slate-50 font-semibold">{r.year}</div>
                        <div className="tabular-nums">
                          <span className="text-xs text-slate-400 mr-2">Netto</span>
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
                          <div className="text-slate-400">Δ Netto</div>
                          <div className={`tabular-nums mt-1 ${r._deltaNet >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {formatCHF(r._deltaNet)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-400">Tippen/Klicken für Details</div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        {/* DESKTOP/TABLET: Matrix (wie Excel) */}
                        <div className="hidden sm:block">
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 overflow-hidden">
                            <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                              <div />
                              <div className="text-right">Start {startYear}</div>
                              <div className="text-right">Ende {endYear}</div>
                              <div className="text-right">Δ Start → Ende</div>
                            </div>

                            <div className="px-3 py-2">
                              <Row
                                label="Aktiven"
                                start={r._startNW.assets}
                                end={r._endNW.assets}
                                delta={r._endNW.assets - r._startNW.assets}
                                bold
                              />
                              <Row
                                label="Passiven"
                                start={r._startNW.debts}
                                end={r._endNW.debts}
                                delta={r._endNW.debts - r._startNW.debts}
                              />
                              <Row
                                label="Netto"
                                start={r._startNW.net}
                                end={r._endNW.net}
                                delta={r._deltaNet}
                                bold
                              />

                              <div className="my-3 border-t border-slate-800" />

                              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Buckets</div>

                              <Row label="Liq" start={r._start.liq} end={r._end.liq} delta={r._deltaBuckets.liq} indent />
                              <Row label="ST" start={r._start.shortA} end={r._end.shortA} delta={r._deltaBuckets.shortA} indent />
                              <Row label="LT" start={r._start.longA} end={r._end.longA} delta={r._deltaBuckets.longA} indent />
                              <Row label="REAL" start={r._start.realA} end={r._end.realA} delta={r._deltaBuckets.realA} indent />
                              <Row label="Schulden ST" start={r._start.shortD ?? 0} end={r._end.shortD ?? 0} delta={r._deltaBuckets.shortD ?? 0} indent />
                              <Row label="Schulden LT" start={r._start.longD ?? 0} end={r._end.longD ?? 0} delta={r._deltaBuckets.longD ?? 0} indent />

                              <Row label="Netto" start={r._startNW.net} end={r._endNW.net} delta={r._deltaNet} bold />
                            </div>
                          </div>
                        </div>

                        {/* MOBILE: stacked, kein horizontal scroll */}
                        <div className="sm:hidden">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                            <div className="flex items-baseline justify-between mb-2">
                              <div className="text-xs uppercase tracking-wide text-slate-400">Start {startYear}</div>
                              <div className="text-xs uppercase tracking-wide text-slate-400">Ende {endYear}</div>
                            </div>

                            <MobileRow
                              label="Aktiven"
                              start={r._startNW.assets}
                              end={r._endNW.assets}
                              delta={r._endNW.assets - r._startNW.assets}
                              bold
                            />
                            <MobileRow
                              label="Passiven"
                              start={r._startNW.debts}
                              end={r._endNW.debts}
                              delta={r._endNW.debts - r._startNW.debts}
                            />
                            <MobileRow label="Netto" start={r._startNW.net} end={r._endNW.net} delta={r._deltaNet} bold />

                            <div className="mt-3 text-xs uppercase tracking-wide text-slate-400">Buckets</div>

                            <MobileRow label="Liq" start={r._start.liq} end={r._end.liq} delta={r._deltaBuckets.liq} indent />
                            <MobileRow label="ST" start={r._start.shortA} end={r._end.shortA} delta={r._deltaBuckets.shortA} indent />
                            <MobileRow label="LT" start={r._start.longA} end={r._end.longA} delta={r._deltaBuckets.longA} indent />
                            <MobileRow label="REAL" start={r._start.realA} end={r._end.realA} delta={r._deltaBuckets.realA} indent />
                            <MobileRow label="Schulden ST" start={r._start.shortD ?? 0} end={r._end.shortD ?? 0} delta={r._deltaBuckets.shortD ?? 0} indent />
                            <MobileRow label="Schulden LT" start={r._start.longD ?? 0} end={r._end.longD ?? 0} delta={r._deltaBuckets.longD ?? 0} indent />

                            <MobileRow label="Netto" start={r._startNW.net} end={r._endNW.net} delta={r._deltaNet} bold />
                          </div>
                        </div>

                        <div className="mt-4 text-xs text-slate-500">
                          Regel (später genauer): Zinsen belasten LIQ. Amortisation senkt Schulden und belastet LIQ (direkt) bzw. kommt aus einer Quelle (indirekt).
                          Wenn LIQ in der Engine nicht negativ werden darf, wird aus ST → LT → REAL umgeschichtet.
                        </div>
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

// (Line bleibt ungenutzt, kannst du löschen – ich lasse es drin, falls du später wieder brauchst.)
function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const v = n(value);
  const clsLeft = strong ? "text-slate-50 font-semibold" : "text-slate-200";
  const clsRight = strong ? "text-slate-50 font-semibold tabular-nums" : "text-slate-50 tabular-nums";
  return (
    <div className="flex items-center justify-between py-1">
      <div className={clsLeft}>{label}</div>
      <div className={clsRight}>{formatCHF(v)}</div>
    </div>
  );
}
