// ===================================
// file: ForecastChartSummary.tsx
// ===================================
"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  Tooltip,
  Bar,
  Rectangle,
} from "recharts";
import type { RectangleProps } from "recharts";

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

/**
 * Custom shapes: keep original props (fill!) and only change radius.
 */
function NetShape(props: any) {
  const p = props as RectangleProps & { payload?: any };
  const r = 10;
  const hasDebt = (p.payload?.debtSeg ?? 0) > 0;
  const radius = hasDebt ? ([0, 0, r, r] as any) : ([r, r, r, r] as any);
  return <Rectangle {...p} radius={radius} />;
}

function DebtShape(props: any) {
  const p = props as RectangleProps & { payload?: any };
  const r = 10;
  const hasNet = (p.payload?.netSeg ?? 0) > 0;
  const radius = hasNet ? ([r, r, 0, 0] as any) : ([r, r, r, r] as any);
  return <Rectangle {...p} radius={radius} />;
}

function TooltipContent({ active, label, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <div
      style={{
        background: "rgba(2,6,23,0.92)",
        border: "1px solid rgba(148,163,184,0.18)", // softer than slate-700
        padding: 12,
        borderRadius: 14,
        boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ color: "rgba(226,232,240,0.85)", marginBottom: 10, letterSpacing: 0.2 }}>
        Jahr {label}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, marginBottom: 8 }}>
        <span style={{ color: "rgba(148,163,184,0.85)" }}>Aktiven</span>
        <span style={{ color: "#22c55e" }}>{formatCHF(p.assets)} CHF</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, marginBottom: 8 }}>
        <span style={{ color: "rgba(148,163,184,0.85)" }}>Passiven</span>
        <span style={{ color: "#ef4444" }}>{formatCHF(p.debts)} CHF</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
        <span style={{ color: "rgba(148,163,184,0.85)" }}>Netto</span>
        <span style={{ color: "rgba(255,255,255,0.95)" }}>{formatCHF(p.net)} CHF</span>
      </div>
    </div>
  );
}

export default function ForecastChartSummary({ rows = [] }: { rows?: YearRow[] }) {
  const data = useMemo(() => {
    const safe = rows ?? [];
    return safe.map((r) => {
      const end = endBucketsOf(r);
      const eNW = netWorth(end);

      const assets = Math.max(0, eNW.assets);
      const debts = Math.max(0, eNW.debts);

      // within ONE assets bar: hatched "debt overlay" + green net remainder
      const debtSeg = Math.min(debts, assets);
      const netSeg = Math.max(0, assets - debtSeg);

      return {
        year: r.year,
        assets,
        debts,
        net: eNW.assets - eNW.debts, // signed (tooltip)
        netSeg,
        debtSeg,
      };
    });
  }, [rows]);

  if (!data.length) return null;

  return (
    <div className="rounded-2xl bg-slate-900/35 p-4 shadow-xl ring-1 ring-white/5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Aktiven / Passiven / Netto</div>
          <div className="mt-0.5 text-xs text-slate-400">
            Passiven schraffiert innerhalb der Aktiven.
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Tooltip: Jahr, Aktiven, Passiven, Netto
        </div>
      </div>

      <div className="h-64 w-full rounded-xl bg-slate-950/25 ring-1 ring-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 14, right: 14, bottom: 0, left: 10 }} barCategoryGap="25%">
            <defs>
              {/* Elegant hatch: softer, less "black lines" */}
              <pattern
                id="debtHatchElegant"
                patternUnits="userSpaceOnUse"
                width="14"
                height="14"
                patternTransform="rotate(45)"
              >
                {/* base is green (assets) */}
                <rect width="14" height="14" fill="#22c55e" />
                {/* subtle dark glass overlay */}
                <rect width="14" height="14" fill="rgba(2,6,23,0.22)" />
                {/* wide, soft hatch lines (greyed, not black) */}
                <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(226,232,240,0.18)" strokeWidth="4" />
              </pattern>
            </defs>

            <XAxis dataKey="year" tick={{ fill: "rgba(148,163,184,0.9)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<TooltipContent />} />

            <Bar dataKey="netSeg" stackId="one" fill="#22c55e" shape={<NetShape />} isAnimationActive={false} />
            <Bar
              dataKey="debtSeg"
              stackId="one"
              fill="url(#debtHatchElegant)"
              shape={<DebtShape />}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
