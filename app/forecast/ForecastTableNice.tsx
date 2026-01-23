"use client";

import { useEffect, useMemo, useState } from "react";

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

// ---------------- helpers (MODULE SCOPE, damit Line() sauber rendern kann) ----------------
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
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
          computed.map((r: any) => {
            const isOpen = openYears.has(r.year);

            return (
              <div key={r.year}>
                <button
                  type="button"
                  onClick={() => toggleYear(r.year)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-900/40 transition"
                  aria-expanded={isOpen}
                >
                  <div className="grid grid-cols-5 gap-2 items-center">
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
                  <div className="mt-1 text-xs text-slate-400">Tippen/Klicken für Details</div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {/* Start */}
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Start Jahr</div>
                          <Line label="Aktiven" value={r._startNW.assets} strong />
                          <Line label="Passiven" value={r._startNW.debts} />
                          <Line label="Netto" value={r._startNW.net} />
                          <div className="mt-3">
                            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Start Buckets</div>
                            <Line label="LIQ" value={r._start.liq} />
                            <Line label="ST" value={r._start.shortA} />
                            <Line label="LT" value={r._start.longA} />
                            <Line label="REAL" value={r._start.realA} />
                            <Line label="Schulden ST" value={r._start.shortD ?? 0} />
                            <Line label="Schulden LT" value={r._start.longD ?? 0} />
                          </div>
                        </div>

                        {/* Ende */}
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Ende Jahr</div>
                          <Line label="Aktiven" value={r._endNW.assets} strong />
                          <Line label="Passiven" value={r._endNW.debts} />
                          <Line label="Netto" value={r._endNW.net} />
                          <div className="mt-3">
                            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Ende Buckets</div>
                            <Line label="LIQ" value={r._end.liq} />
                            <Line label="ST" value={r._end.shortA} />
                            <Line label="LT" value={r._end.longA} />
                            <Line label="REAL" value={r._end.realA} />
                            <Line label="Schulden ST" value={r._end.shortD ?? 0} />
                            <Line label="Schulden LT" value={r._end.longD ?? 0} />
                          </div>
                        </div>

                        {/* Delta */}
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Δ (Start → Ende)</div>
                          <Line label="Δ LIQ" value={r._deltaBuckets.liq} />
                          <Line label="Δ ST" value={r._deltaBuckets.shortA} />
                          <Line label="Δ LT" value={r._deltaBuckets.longA} />
                          <Line label="Δ REAL" value={r._deltaBuckets.realA} />
                          <Line label="Δ Schulden ST" value={r._deltaBuckets.shortD ?? 0} />
                          <Line label="Δ Schulden LT" value={r._deltaBuckets.longD ?? 0} />
                          <div className="mt-3 border-t border-slate-800 pt-3">
                            <Line label="Δ Netto" value={r._deltaNet} strong />
                          </div>
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
  );
}

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
