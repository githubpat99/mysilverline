"use client";

import { useMemo } from "react";
import { formatCHF } from "@/lib/format";

type Props = {
  totalAssets: number;
  totalLiabilities: number;
};

export default function BalanceSummaryChart({
  totalAssets,
  totalLiabilities,
}: Props) {
  const { saldo, passiven, aktiven, ekPct } = useMemo(() => {
    const a = Math.max(0, Math.trunc(totalAssets));
    const p = Math.max(0, Math.trunc(totalLiabilities));
    const s = Math.max(0, a - p);
    const pct = a > 0 ? Math.min(100, (s / a) * 100) : 0;
    return { saldo: s, passiven: p, aktiven: a, ekPct: pct };
  }, [totalAssets, totalLiabilities]);

  const passPct = 100 - ekPct;

  return (
    <div className="rounded-2xl bg-slate-900/35 p-4 shadow-xl ring-1 ring-white/5">
      <div className="w-full" style={{ minHeight: 72 }}>
        {/* EK / Schulden labels */}
        <div className="flex items-end mb-1.5">
          <div
            className="text-center text-sm font-semibold text-sky-400 tabular-nums"
            style={{ width: `calc(${ekPct}% - 2px)` }}
          >
            {formatCHF(saldo)}
          </div>
          <div style={{ width: 4 }} />
          <div
            className="text-center text-sm font-semibold text-red-300 tabular-nums"
            style={{ width: `calc(${passPct}% - 2px)` }}
          >
            {formatCHF(passiven)}
          </div>
        </div>

        {/* Bar segments with gap */}
        <div className="flex items-center" style={{ height: 7 }}>
          <div
            className="h-full rounded-l-full"
            style={{
              width: `calc(${ekPct}% - 2px)`,
              background: "#0ea5e9",
            }}
          />
          <div className="flex items-center justify-center" style={{ width: 4 }}>
            <div
              className="bg-slate-200"
              style={{ width: 7, height: 7, borderRadius: 2 }}
            />
          </div>
          <div
            className="h-full rounded-r-full bg-slate-700"
            style={{ width: `calc(${passPct}% - 2px)` }}
          />
        </div>

        {/* Vermögen total with end markers */}
        <div className="flex items-start mt-1.5">
          <div className="bg-slate-600" style={{ width: 1, height: 8 }} />
          <div className="flex-1 text-center text-sm text-green-300 tabular-nums">
            {formatCHF(aktiven)}
          </div>
          <div className="bg-slate-600" style={{ width: 1, height: 8 }} />
        </div>
      </div>
    </div>
  );
}
