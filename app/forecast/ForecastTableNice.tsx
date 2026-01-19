"use client";

import { useMemo, useState } from "react";

export type YearRow = {
  year: number;

  // End-of-year buckets (as currently produced by computeForecast.ts rows.push)
  liq: number;
  shortA: number;
  longA: number;
  realA: number;

  shortD?: number;
  longD?: number;

  // Optional explanation lines
  netFlow?: number;
  assetCF?: number;
  events?: number;

  // NEW (optional): start-of-year buckets for explanation (Option A)
  start?: {
    liq: number;
    shortA: number;
    longA: number;
    realA: number;
    shortD?: number;
    longD?: number;
  };
};

function formatCHF(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString("de-CH");
}

function sum(...xs: number[]) {
  return xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export default function ForecastTableNice({ rows = [] }: { rows?: YearRow[] }) {
  const safeRows = rows ?? [];

  const computed = useMemo(() => {
    return safeRows.map((r, i) => {
      const assetsEnd = sum(r.liq, r.shortA, r.longA, r.realA);
      const debtsEnd = sum(r.shortD ?? 0, r.longD ?? 0);
      const endYear = assetsEnd - debtsEnd;

      const assetsStart =
        r.start != null
          ? sum(r.start.liq, r.start.shortA, r.start.longA, r.start.realA)
          : assetsEnd; // fallback if start not provided
      const debtsStart =
        r.start != null ? sum(r.start.shortD ?? 0, r.start.longD ?? 0) : debtsEnd;
      const startYear = assetsStart - debtsStart;

      const prevEnd =
        i > 0
          ? (() => {
              const p = safeRows[i - 1];
              const pa = sum(p.liq, p.shortA, p.longA, p.realA);
              const pd = sum(p.shortD ?? 0, p.longD ?? 0);
              return pa - pd;
            })()
          : endYear;

      const diff = endYear - prevEnd;

      return { ...r, assetsEnd, debtsEnd, endYear, assetsStart, debtsStart, startYear, diff };
    });
  }, [safeRows]);

  // All rows collapsed by default (empty Set)
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
          <div className="text-right">Ende Jahr</div>
          <div className="text-right">Differenz</div>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800">
        {computed.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">Keine Forecast-Daten vorhanden.</div>
        ) : (
          computed.map((r) => {
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
                    <div className="text-right text-slate-50 tabular-nums">{formatCHF(r.assetsEnd)}</div>
                    <div className="text-right text-slate-50 tabular-nums">{formatCHF(r.debtsEnd)}</div>
                    <div className="text-right text-slate-50 tabular-nums">{formatCHF(r.endYear)}</div>
                    <div className="text-right tabular-nums">
                      <span className={r.diff >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {formatCHF(r.diff)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-slate-400">Tippen/Klicken für Details</div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      {/* START vs END */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                            Start Jahr (Bestände)
                          </div>
                          <Line label="Aktiven" value={r.assetsStart} strong />
                          <Line label="Passiven" value={r.debtsStart} />
                          <Line label="Netto" value={r.startYear} />
                          {r.start && (
                            <div className="mt-3">
                              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                                Start Buckets
                              </div>
                              <Line label="LIQ" value={r.start.liq} />
                              <Line label="ST" value={r.start.shortA} />
                              <Line label="LT" value={r.start.longA} />
                              <Line label="REAL" value={r.start.realA} />
                              <Line label="Kurzfristige Schulden" value={r.start.shortD ?? 0} />
                              <Line label="Langfristige Schulden" value={r.start.longD ?? 0} />
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                            Ende Jahr (Bestände)
                          </div>
                          <Line label="Aktiven" value={r.assetsEnd} strong />
                          <Line label="Passiven" value={r.debtsEnd} />
                          <Line label="Netto" value={r.endYear} />
                          <div className="mt-3">
                            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                              Ende Buckets
                            </div>
                            <Line label="LIQ" value={r.liq} />
                            <Line label="ST" value={r.shortA} />
                            <Line label="LT" value={r.longA} />
                            <Line label="REAL" value={r.realA} />
                            <Line label="Kurzfristige Schulden" value={r.shortD ?? 0} />
                            <Line label="Langfristige Schulden" value={r.longD ?? 0} />
                          </div>
                        </div>
                      </div>

                      {(r.netFlow !== undefined || r.assetCF !== undefined || r.events !== undefined) && (
                        <div className="mt-4">
                          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                            Veränderung (Erklärung)
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <Line label="Netto-Flow" value={r.netFlow ?? 0} />
                            <Line label="Asset CF" value={r.assetCF ?? 0} />
                            <Line label="Events" value={r.events ?? 0} />
                          </div>

                          <div className="mt-2 text-xs text-slate-500">
                            Hinweis: Wenn LIQ negativ würde, deckt der Forecast das Defizit automatisch aus ST → LT → REAL.
                            Darum können ST/LT/REAL im Endjahr sinken, obwohl der Netto-Flow „nur“ die Liquidität betrifft.
                          </div>
                        </div>
                      )}
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
  return (
    <div className="flex items-center justify-between py-1">
      <div className={strong ? "text-slate-50 font-semibold" : "text-slate-200"}>{label}</div>
      <div className={strong ? "text-slate-50 font-semibold tabular-nums" : "text-slate-50 tabular-nums"}>
        {formatCHF(value)}
      </div>
    </div>
  );
}
