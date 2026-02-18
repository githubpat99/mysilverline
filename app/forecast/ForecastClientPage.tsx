"use client";

import { useEffect, useState } from "react";
import ForecastTableNice, { type YearRow } from "./ForecastTableNice";
import { computeForecastFromProfileV2 } from "@/lib/forecast/computeForecastFromProfileV2";
import { loadProfile, loadPositions } from "@/lib/services/dataService";
import type { ProfileV2 } from "@/lib/types/v2";

export default function ForecastClientPage() {
    const [rows, setRows] = useState<YearRow[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [retirementYear, setRetirementYear] = useState<number | undefined>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function run() {
            try {
                const resp = await loadProfile();
                const profile = resp.profile;
                const pos = await loadPositions();

                if (!profile) {
                    setRows([]);
                    setPositions([]);
                    setRetirementYear(undefined);
                    return;
                }
                const out = computeForecastFromProfileV2(profile, pos);
                setRows((out as any).rows ?? []);
                setPositions(pos ?? []);
                setRetirementYear((out as any).retirementYear);
            } catch (e) {
                console.error("[Forecast] compute failed", e);
                setRows([]);
                setPositions([]);
                setRetirementYear(undefined);
            } finally {
                setLoading(false);
            }
        }

        run();
    }, []);

    if (loading) {
        return <div className="text-sm text-slate-400">Forecast wird berechnet …</div>;
    }


    return <ForecastTableNice rows={rows} positions={positions} retirementYear={retirementYear} />;
}
