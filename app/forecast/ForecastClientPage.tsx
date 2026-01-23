"use client";

import { useEffect, useState } from "react";
import ForecastTableNice, { type YearRow } from "./ForecastTableNice";
import { computeForecastFromProfileV2 } from "@/lib/forecast/computeForecastFromProfileV2";
import { loadProfileV2 } from "@/lib/profileApiV2";
import type { ProfileV2 } from "@/lib/types/v2";
import { loadPositions } from "@/lib/load/types";

export default function ForecastClientPage() {
    const [rows, setRows] = useState<YearRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function run() {
            try {
                const resp = await loadProfileV2();        // <- Wrapper
                const profile = resp.profile;              // <- echtes ProfileV2 | null
                const positions = await loadPositions(); // dein /positions API call

                if (!profile) {
                    console.log("NO PROFILE");
                    setRows([]);
                    return;
                }
                const out = computeForecastFromProfileV2(profile, positions);
                const rows = (out as any).rows ?? [];

                setRows(rows);

            } finally {
                setLoading(false);
            }
        }

        run();
    }, []);

    if (loading) {
        return <div className="text-sm text-slate-400">Forecast wird berechnet …</div>;
    }


    return <ForecastTableNice rows={rows} />;
}
