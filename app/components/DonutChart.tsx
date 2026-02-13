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

  return (
    <div className="rounded-2xl bg-slate-900/35 p-4 shadow-xl ring-1 ring-white/5">
      <div className="relative aspect-[900/110] w-full min-h-[88px]">
        {/* SVG: nur die Linie */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 900 110"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient
              id="lineBlue"
              x1="40"
              y1="0"
              x2="860"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#3B82F6" />
              <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
          </defs>
          <line
            x1="40"
            y1="55"
            x2="860"
            y2="55"
            stroke="url(#lineBlue)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>

        {/* Labels als HTML – exakt wie Total (text-lg), responsive */}
        <div className="absolute inset-0">
          {/* Netto links */}
          <div className="absolute left-[4.4%] top-[28%] -translate-y-1/2 text-lg font-normal text-white tabular-nums">
            {formatCHF(saldo)}
          </div>

          {/* ▼ – grösser auf Mobile */}
          <div
            className="absolute top-[50%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 sm:w-3 sm:h-3"
            style={{ left: `${4.4 + (boundaryPct / 100) * 91.1}%` }}
          >
            <div className="w-full h-full [clip-path:polygon(0%_0%,100%_0%,50%_100%)] bg-white" />
          </div>

          {/* Passiven rechts */}
          <div className="absolute top-[28%] right-[4.4%] -translate-y-1/2 text-right text-lg font-normal text-red-300 tabular-nums">
            {formatCHF(passiven)}
          </div>

          {/* Aktiven unten mittig */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center text-lg font-normal text-green-300 tabular-nums">
            {formatCHF(aktiven)}
          </div>
        </div>
      </div>
    </div>
  );
}
