"use client";

import { useEffect, useState } from "react";
import ForecastTableNice, { type YearRow } from "./ForecastTableNice";
import { computeForecastFromProfileV2 } from "@/lib/forecast/computeForecastFromProfileV2";
import { loadProfileV2 } from "@/lib/profileApiV2";
import type { ProfileV2 } from "@/lib/types/v2";
import { loadPositions } from "@/lib/load/types";

export default function ForecastClientPage() {
    const [rows, setRows] = useState<YearRow[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function run() {
            try {
                const resp = await loadProfileV2();
                const profile = resp.profile;
                const pos = await loadPositions();

                if (!profile) {
                    setRows([]);
                    setPositions([]);
                    return;
                }
                const out = computeForecastFromProfileV2(profile, pos);
                setRows((out as any).rows ?? []);
                setPositions(pos ?? []);

            } finally {
                setLoading(false);
            }
        }

        run();
    }, []);

    if (loading) {
        return <div className="text-sm text-slate-400">Forecast wird berechnet …</div>;
    }


    return <ForecastTableNice rows={rows} positions={positions} />;
}
