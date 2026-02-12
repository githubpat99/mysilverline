// ===================================
// file: ForecastChartSummary.tsx
// ===================================
"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

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
  liq: number;
  shortA: number;
  longA: number;
  realA: number;
  shortD?: number;
  longD?: number;
  start?: Buckets;

  // optional extras (ignored here)
  netFlow?: number;
  assetCF?: number;
  events?: number;

  // optional future fields (ignored here)
  assetCashflowToLiq?: number;
  assetCashflowReinvest?: number;
  debtInterest?: number;
  debtAmort?: number;
};

function n(x: any): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}
function sum(...xs: number[]) {
  return xs.reduce((a, b) => a + n(b), 0);
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

function netWorth(b: Buckets) {
  const assets = sum(b.liq, b.shortA, b.longA, b.realA);
  const debts = sum(b.shortD ?? 0, b.longD ?? 0);
  return { assets, debts, net: assets - debts };
}

function formatCHF(v: number) {
  return Math.trunc(n(v)).toLocaleString("de-CH");
}

function LineTooltipContent({ active, label, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div
      style={{
        background: "rgba(2,6,23,0.95)",
        border: "1px solid rgba(148,163,184,0.2)",
        padding: "10px 14px",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ color: "rgba(148,163,184,0.9)", fontSize: 12 }}>Jahr {label}</div>
      <div style={{ color: "#38bdf8", fontSize: 15, fontWeight: 600, marginTop: 4 }}>
        {formatCHF(p.net)} CHF
      </div>
    </div>
  );
}

const PERIOD_OPTIONS = [
  { key: "3J", label: "3 Jahre", n: 3 },
  { key: "5J", label: "5 Jahre", n: 5 },
  { key: "10J", label: "10 Jahre", n: 10 },
  { key: "Gesamt", label: "Gesamt", n: 0 },
] as const;

export default function ForecastChartSummary({ rows = [] }: { rows?: YearRow[] }) {
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["key"]>("Gesamt");

  const lineData = useMemo(() => {
    const safe = rows ?? [];
    return safe.map((r) => {
      const end = endBucketsOf(r);
      const eNW = netWorth(end);
      return { year: r.year, net: eNW.assets - eNW.debts };
    });
  }, [rows]);

  const visiblePeriodOptions = useMemo(() => {
    const n = lineData.length;
    if (n < 4) return [];
    return PERIOD_OPTIONS.filter((o) => {
      if (o.key === "Gesamt") return true;
      if (o.key === "3J") return n >= 4 && n < 6;
      if (o.key === "5J") return n > 5; // erst wenn Basis > 5 (wie 10J erst bei > 10)
      if (o.key === "10J") return n > 10;
      return true;
    });
  }, [lineData.length]);

  const periodOpt = PERIOD_OPTIONS.find((o) => o.key === period) ?? PERIOD_OPTIONS[3];
  const visibleLineData = useMemo(() => {
    if (periodOpt.n <= 0) return lineData;
    return lineData.slice(0, periodOpt.n);
  }, [lineData, periodOpt.n]);

  const lineKpi = useMemo(() => {
    if (visibleLineData.length < 2) return { delta: 0, pct: 0, end: visibleLineData[0]?.net ?? 0 };
    const start = visibleLineData[0].net;
    const end = visibleLineData[visibleLineData.length - 1].net;
    const delta = end - start;
    const pct = start !== 0 ? (delta / start) * 100 : 0;
    return { delta, pct, end };
  }, [visibleLineData]);

  if (!lineData.length) return null;

  return (
    <div className="rounded-2xl bg-slate-900/35 p-4 shadow-xl ring-1 ring-white/5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Δ Eigenkapital im Zeitraum</div>
          <div
            className={`text-lg font-semibold tabular-nums ${
              lineKpi.delta >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {lineKpi.delta >= 0 ? "+" : ""}
            {formatCHF(lineKpi.delta)} CHF
            {lineKpi.pct !== 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({lineKpi.pct >= 0 ? "+" : ""}
                {lineKpi.pct.toFixed(1)} %)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="h-56 w-full rounded-xl bg-slate-950/25 ring-1 ring-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleLineData} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="year"
              tick={{ fill: "rgba(148,163,184,0.85)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<LineTooltipContent />} />
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" strokeWidth={1} />
            {visibleLineData.length > 0 && (
              <ReferenceLine
                y={visibleLineData[0].net}
                stroke="rgba(148,163,184,0.25)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Area
              type="monotone"
              dataKey="net"
              stroke="#38bdf8"
              strokeWidth={2}
              fill="url(#areaGrad)"
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {visiblePeriodOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visiblePeriodOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              className={`min-h-11 min-w-11 rounded-lg px-3 py-2 text-xs font-medium transition touch-manipulation ${
                period === opt.key
                  ? "bg-slate-100 text-slate-900"
                  : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
