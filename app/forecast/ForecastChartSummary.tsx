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
  ReferenceDot,
} from "recharts";
import { AlertTriangle } from "lucide-react";

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

  netFlow?: number;
  assetCF?: number;
  events?: number;

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

function ChartTooltipContent({ active, label, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const liqCritical = p.liq <= 0;
  return (
    <div
      style={{
        background: "rgba(2,6,23,0.95)",
        border: `1px solid ${liqCritical ? "rgba(245,158,11,0.5)" : "rgba(148,163,184,0.2)"}`,
        padding: "10px 14px",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        minWidth: 140,
      }}
    >
      <div style={{ color: "rgba(148,163,184,0.9)", fontSize: 12 }}>Jahr {label}</div>
      <div
        style={{
          color: p.net >= (p.prevNet ?? p.net) ? "#10b981" : "#f43f5e",
          fontSize: 15,
          fontWeight: 600,
          marginTop: 4,
        }}
      >
        {formatCHF(p.net)} CHF
      </div>
      <div
        style={{
          color: liqCritical ? "#f59e0b" : "#94a3b8",
          fontSize: 12,
          marginTop: 4,
          fontWeight: liqCritical ? 600 : 400,
        }}
      >
        {liqCritical && "⚠ "}Liquidität: {formatCHF(p.liq)} CHF
      </div>
    </div>
  );
}

function buildStrokeGradient(data: { year: number; net: number }[]) {
  if (data.length < 2) return [];
  const total = data.length - 1;
  const stops: { offset: string; color: string }[] = [];
  for (let i = 0; i < total; i++) {
    const pctStart = (i / total) * 100;
    const pctEnd = ((i + 1) / total) * 100;
    const color = data[i + 1].net >= data[i].net ? "#10b981" : "#f43f5e";
    stops.push({ offset: `${pctStart.toFixed(1)}%`, color });
    stops.push({ offset: `${pctEnd.toFixed(1)}%`, color });
  }
  return stops;
}

const PERIOD_OPTIONS = [
  { key: "3J", label: "3 Jahre", n: 3 },
  { key: "5J", label: "5 Jahre", n: 5 },
  { key: "10J", label: "10 Jahre", n: 10 },
  { key: "Gesamt", label: "Gesamt", n: 0 },
] as const;

export default function ForecastChartSummary({
  rows = [],
  retirementYear,
}: {
  rows?: YearRow[];
  retirementYear?: number;
}) {
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["key"]>("Gesamt");

  const lineData = useMemo(() => {
    const safe = rows ?? [];
    return safe.map((r, i) => {
      const end = endBucketsOf(r);
      const eNW = netWorth(end);
      const netVal = eNW.assets - eNW.debts;
      const prevNet =
        i > 0
          ? (() => {
              const pe = endBucketsOf(safe[i - 1]);
              return netWorth(pe).net;
            })()
          : netVal;
      return { year: r.year, net: netVal, liq: n(r.liq), prevNet };
    });
  }, [rows]);

  const visiblePeriodOptions = useMemo(() => {
    const n = lineData.length;
    if (n < 4) return [];
    return PERIOD_OPTIONS.filter((o) => {
      if (o.key === "Gesamt") return true;
      if (o.key === "3J") return n >= 4 && n < 6;
      if (o.key === "5J") return n > 5;
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

  const strokeStops = useMemo(() => buildStrokeGradient(visibleLineData), [visibleLineData]);

  const liqWarnings = useMemo(
    () => visibleLineData.filter((d) => d.liq <= 0),
    [visibleLineData],
  );
  const firstLiqCriticalYear = liqWarnings.length > 0 ? liqWarnings[0].year : null;

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

      {firstLiqCriticalYear != null && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong>Liquiditäts-Warnung:</strong> Ab {firstLiqCriticalYear} sinkt die
            Liquidität auf 0 oder darunter.
            {liqWarnings.length > 1 && ` (${liqWarnings.length} Jahre betroffen)`}
          </span>
        </div>
      )}

      <div className="h-56 min-h-[180px] w-full rounded-xl bg-slate-950/25 ring-1 ring-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleLineData} margin={{ top: 28, right: 12, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="areaFillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
              {strokeStops.length > 0 && (
                <linearGradient id="strokeDirectionGrad" x1="0" y1="0" x2="1" y2="0">
                  {strokeStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
              )}
              {strokeStops.length > 0 && (
                <linearGradient id="fillDirectionGrad" x1="0" y1="0" x2="1" y2="0">
                  {strokeStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.12} />
                  ))}
                </linearGradient>
              )}
            </defs>
            <XAxis
              dataKey="year"
              tick={{ fill: "rgba(148,163,184,0.85)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltipContent />} />
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" strokeWidth={1} />
            {visibleLineData.length > 0 && (
              <ReferenceLine
                y={visibleLineData[0].net}
                stroke="rgba(148,163,184,0.25)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {retirementYear != null &&
              visibleLineData.some((d) => d.year === retirementYear) && (
                <ReferenceLine
                  x={retirementYear}
                  stroke="rgba(148,163,184,0.6)"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  label={{
                    value: "Pensionierung",
                    position: "top",
                    fill: "rgba(148,163,184,0.9)",
                    fontSize: 11,
                    offset: 8,
                  }}
                />
              )}
            <Area
              type="monotone"
              dataKey="net"
              stroke={strokeStops.length > 0 ? "url(#strokeDirectionGrad)" : "#38bdf8"}
              strokeWidth={2.5}
              fill={strokeStops.length > 0 ? "url(#fillDirectionGrad)" : "url(#areaFillGrad)"}
              isAnimationActive={true}
            />
            {liqWarnings.map((d) => (
              <ReferenceDot
                key={`liq-${d.year}`}
                x={d.year}
                y={d.net}
                r={5}
                fill="#f59e0b"
                stroke="#fbbf24"
                strokeWidth={2}
              />
            ))}
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
