"use client";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
} from "recharts";

import { formatCHF } from "@/lib/format";

export type ForecastPoint = {
    age: number;          // Alter Person 1
    wealth: number;       // Vermögen in CHF (ganze CHF)
};

export default function ForecastChart({
    data,
    retireAtAge,
    onSelectAge,
}: {
    data: ForecastPoint[];
    retireAtAge: number;
    onSelectAge?: (age: number) => void;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-3 text-sm text-slate-300">Vermögensverlauf (CHF)</div>

            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        onClick={(e: any) => {
                            const age = e?.activeLabel;
                            if (typeof age === "number") onSelectAge?.(age);
                        }}
                    >

                        <XAxis dataKey="age" tick={{ fontSize: 12 }} />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(v) => formatCHF(Number(v))}
                            width={90}
                        />
                        <Tooltip
                            formatter={(v) => formatCHF(Number(v))}
                            labelFormatter={(l) => `Alter ${l}`}
                            cursor={{ stroke: "rgba(226,232,240,0.18)", strokeDasharray: "3 3" }}
                            contentStyle={{
                                backgroundColor: "rgba(2, 6, 23, 0.55)", // slate-950/55
                                border: "1px solid rgba(148, 163, 184, 0.25)", // slate-400/25
                                borderRadius: 10,
                                padding: "6px 8px",
                                boxShadow: "none",
                            }}
                            labelStyle={{
                                color: "rgba(226,232,240,0.65)",
                                fontSize: 11,
                                marginBottom: 2,
                            }}
                            itemStyle={{
                                color: "rgba(226,232,240,0.95)",
                                fontSize: 12,
                                padding: 0,
                            }}
                        />

                        <ReferenceLine y={0} strokeDasharray="4 4" />
                        {typeof retireAtAge === "number" && (
                            <ReferenceLine
                                x={retireAtAge}
                                strokeDasharray="4 4"
                                label={{
                                    value: "Pensionierung",
                                    position: "insideTopRight",
                                    fill: "rgba(226,232,240,0.9)", // slate-ish, subtil
                                    fontSize: 12,
                                }}
                            />
                        )}
                        <Line type="monotone" dataKey="wealth" dot={false} strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
