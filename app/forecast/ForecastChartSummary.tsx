"use client";

import { useMemo } from "react";
import {
    ResponsiveContainer,
    ComposedChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Bar,
    Line,
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

export default function ForecastChartSummary({ rows = [] }: { rows?: YearRow[] }) {
    const data = useMemo(() => {
        const safe = rows ?? [];
        return safe.map((r, i) => {
            const end = endBucketsOf(r);
            const start: Buckets = r.start ?? (i > 0 ? endBucketsOf(safe[i - 1]) : end);

            const sNW = netWorth(start);
            const eNW = netWorth(end);

            return {
                year: r.year,
                assets: eNW.assets,
                debts: eNW.debts,
                net: eNW.net,
                startNet: sNW.net,
            };
        });
    }, [rows]);

    if (!data.length) return null;

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                Aktiven / Passiven / Netto
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>

                        <XAxis
                            dataKey="year"
                            tick={{ fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                        />

                        <Tooltip
                            contentStyle={{
                                background: "rgba(2,6,23,0.95)",
                                border: "1px solid #334155"
                            }}
                            labelStyle={{ color: "#cbd5e1" }}
                            formatter={(value: any) =>
                                Math.trunc(Number(value ?? 0)).toLocaleString("de-CH")
                            }
                        />

                        {/* Aktiven */}
                        <Bar
                            dataKey="assets"
                            fill="#22c55e"
                            radius={[6, 6, 0, 0]}
                        />

                        {/* Passiven */}
                        <Bar
                            dataKey="debts"
                            fill="#ef4444"
                            radius={[6, 6, 0, 0]}
                        />

                        {/* Netto Linie */}
                        <Line
                            type="monotone"
                            dataKey="net"
                            stroke="#ffffff"
                            strokeWidth={2}
                            dot={false}
                        />

                    </ComposedChart>
                </ResponsiveContainer>
            </div>

        </div>
    );
}
