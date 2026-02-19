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
  const { saldo, passiven, aktiven, boundaryPct } = useMemo(() => {
    const a = Math.max(0, Math.trunc(totalAssets));
    const p = Math.max(0, Math.trunc(totalLiabilities));
    const s = Math.max(0, a - p);
    const pct = a > 0 ? (s / a) * 100 : 0;
    return { saldo: s, passiven: p, aktiven: a, boundaryPct: pct };
  }, [totalAssets, totalLiabilities]);

  const markerLeft = `${4.4 + (boundaryPct / 100) * 91.1}%`;

  return (
    <div className="rounded-2xl bg-slate-900/35 p-4 shadow-xl ring-1 ring-white/5">
      <div className="relative w-full" style={{ minHeight: 72 }}>
        {/* Labels row */}
        <div className="flex items-end justify-between mb-3">
          <div className="text-lg font-normal text-white tabular-nums">
            {formatCHF(saldo)}
          </div>
          <div className="text-lg font-normal text-red-300 tabular-nums">
            {formatCHF(passiven)}
          </div>
        </div>

        {/* Track + Fill + Marker */}
        <div className="relative h-[6px] rounded-full bg-slate-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: markerLeft,
              background: "linear-gradient(90deg, #22d3ee, #818cf8)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-sm"
            style={{
              left: markerLeft,
              border: "2px solid #0f172a",
              boxShadow: "0 0 0 1px rgba(100,116,139,0.5)",
            }}
          />
        </div>

        {/* Aktiven total */}
        <div className="mt-2 text-center text-lg font-normal text-green-300 tabular-nums">
          {formatCHF(aktiven)}
        </div>
      </div>
    </div>
  );
}
