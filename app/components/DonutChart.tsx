"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCHFInput, parseCHF } from "@/lib/format";

export default function DonutChart({
    aktiven,
    passiven,
}: {
    aktiven: number;
    passiven: number;
}) {
    const netto = aktiven - passiven;

    const data = [
        { name: "Aktiven", value: aktiven },
        { name: "Passiven", value: passiven },
    ];

    const COLORS = ["#22c55e", "#ef4444"];

    return (
        <div
            className="relative w-full h-72 sm:h-80 lg:h-96 bg-slate-900/60 border 
                 border-slate-800 rounded-2xl p-6 shadow-lg select-none"
            style={{ WebkitTapHighlightColor: "transparent" }}
        >
            <h3 className="text-xl font-semibold mb-4 text-center">
                Vermögensstruktur
            </h3>

            {/* Nettovermögen in der Mitte – kleiner auf Mobile */}
            <div
                className="
                    absolute inset-0 
                    flex flex-col items-center justify-center 
                    pointer-events-none 
                    px-4

                    translate-y-[14px]     /* Mobile: weiter nach unten */
                    sm:translate-y-[4px]   /* Tablet: leichte Korrektur */
                    md:translate-y-0       /* Desktop: perfekt mittig */
                "
            >
                <span className="text-[11px] sm:text-xs md:text-sm text-slate-300 text-center">
                    Nettovermögen
                </span>

                <span
                    className={`mt-1 font-bold 
                        text-xl sm:text-2xl md:text-3xl 
                        text-center 
                        ${netto >= 0 ? "text-green-400" : "text-red-400"}
                        `}
                >
                    {formatCHFInput(netto.toString())}
                </span>
            </div>

            <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                    <Pie
                        data={data}
                        // dünnerer Ring, mehr Innenfläche
                        innerRadius="72%"
                        outerRadius="90%"
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive
                        animationDuration={900}
                        animationEasing="ease-out"
                    >
                        {data.map((_, index) => (
                            <Cell key={index} fill={COLORS[index]} />
                        ))}
                    </Pie>

                    <Tooltip
                        formatter={(value) => formatCHFInput(String(value ?? 0))}
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                            background: "#e5e7eb",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            color: "#111827",
                            fontSize: "0.85rem",
                        }}
                        itemStyle={{ color: "#111827" }}
                        labelStyle={{ color: "#374151" }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
