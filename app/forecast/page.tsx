"use client";
import { useEffect, useMemo, useState } from "react";

import ForecastChart from "./ForecastChart";
import { computeForecastWithBreakdown } from "@/lib/forecast";
import { forecastInputFromFinanceProfile } from "@/lib/forecast/financeMapping";
import { loadProfile } from "@/lib/profileApi";
import type { ForecastPoint } from "@/lib/forecast";

export default function ForecastPage() {
  const [data, setData] = useState<ForecastPoint[]>([]);
  const [emptyMsg, setEmptyMsg] = useState<string>("");
  const [retireAtAge, setRetireAtAge] = useState<number>(65);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const baseYear = new Date().getFullYear();

      const profile = await loadProfile();
      if (cancelled) return;

      if (!profile) {
        setEmptyMsg("Kein Finance-Profil gefunden. Bitte zuerst im Finance-Workflow speichern.");
        setData([]);
        return;
      }

      setRetireAtAge(profile.step1?.retireAtAge ?? 65);

      const built = forecastInputFromFinanceProfile(profile, { baseYear });

      if (!built.ok) {
        setEmptyMsg(built.message);
        setData([]);
        return;
      }

      const { points /*, breakdowns */ } =
        computeForecastWithBreakdown(built.input);

      setData(points);
      // breakdowns später, wenn du sie brauchst
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const { minWealth, minAge } = useMemo(() => {
    if (!data.length) return { minWealth: null as number | null, minAge: null as number | null };
    let m = data[0].wealth;
    let a = data[0].age;
    for (const p of data) {
      if (p.wealth < m) {
        m = p.wealth;
        a = p.age;
      }
    }
    return { minWealth: m, minAge: a };
  }, [data]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {emptyMsg ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <div className="text-lg font-semibold text-slate-100">Keine Daten</div>
          <div className="mt-1 text-sm text-slate-400">{emptyMsg}</div>

          <a
            href="/app-static/finance"
            className="mt-3 inline-block text-sm text-slate-200 underline decoration-slate-600 underline-offset-4"
          >
            Zum Finance-Workflow
          </a>
        </div>
      ) : (
        <>
          <ForecastHeader minWealth={minWealth} minAge={minAge} />
          <ForecastChart data={data} retireAtAge={retireAtAge} />
        </>
      )}
    </div>
  );
}

function ForecastHeader({
  minWealth,
  minAge,
}: {
  minWealth: number | null;
  minAge: number | null;
}) {
  const status = minWealth !== null && minWealth >= 0 ? "ok" : "risk";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-center">
      {/* LEFT */}
      <div className="flex items-start gap-4">
        <div className={`mt-1 h-4 w-4 rounded-full ${status === "ok" ? "bg-emerald-400" : "bg-rose-400"}`} />
        <div>
          <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
            Finance-Forecast
          </span>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {status === "ok" ? "Reicht langfristig" : "Reicht nicht"}
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 lg:justify-self-center lg:min-w-[260px]">
        <div className="text-sm text-slate-400">Tiefster Stand</div>
        <div className="mt-1 text-2xl font-semibold text-slate-100">
          {minWealth !== null ? `${minWealth.toLocaleString("de-CH")} CHF` : "–"}
        </div>
        <div className="text-sm text-slate-400">{minAge !== null ? `bei Alter ${minAge}` : "–"}</div>
      </div>

      {/* RIGHT */}
      <div className="lg:justify-self-end lg:w-[320px]">
        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
          <div className="text-sm text-slate-400 mb-2">Szenario</div>
          <div className="text-xs text-slate-500">Keine Overlay-Parameter im Finance-Forecast.</div>
        </div>
      </div>
    </div>
  );
}
