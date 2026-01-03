"use client";
import { useEffect, useMemo, useState } from "react";

import ForecastChart from "./ForecastChart";
import MoneyInput from "@/app/lotto/components/MoneyInput";

import { loadLottoDraft } from "@/lib/lotto/persist";
import { forecastInputFromLottoDraft, computeForecast } from "@/lib/forecast";
import { forecastInputFromFinanceProfile } from "@/lib/forecast/financeMapping";
import { loadProfile } from "@/lib/profileApi";
import type { ForecastPoint } from "@/lib/forecast";
import type { Model1DraftState } from "@/lib/lotto/types";

type Src = "finance" | "lotto";

function getSrcFromUrl(): Src {
  if (typeof window === "undefined") return "lotto";
  const sp = new URLSearchParams(window.location.search);
  return sp.get("src") === "finance" ? "finance" : "lotto";
}

export default function ForecastPage() {
  const [src, setSrc] = useState<Src>(() => getSrcFromUrl());
  const [data, setData] = useState<ForecastPoint[]>([]);
  const [lottoWin, setLottoWin] = useState<number>(1_000_000);
  const [emptyMsg, setEmptyMsg] = useState<string>("");
  const [retireAtAge, setRetireAtAge] = useState<number>(65);

  // keep src synced if user navigates / changes query manually
  useEffect(() => {
    const next = getSrcFromUrl();
    setSrc(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const baseYear = new Date().getFullYear();

      if (src === "finance") {
        const profile = await loadProfile();
        if (cancelled) return;

        if (!profile) {
          setEmptyMsg("Kein Finance-Profil gefunden. Bitte zuerst im Finance-Workflow speichern.");
          setData([]);
          return;
        }

        // Übergangslösung, bis birthDate vollständig im Forecast genutzt wird
        const selfAgeToday = 45; // TODO später aus birthDate berechnen

        setRetireAtAge(profile.step1?.retireAtAge ?? 65);

        const built = forecastInputFromFinanceProfile(profile, { baseYear });

        if (!built.ok) {
          setEmptyMsg(built.message);
          setData([]);
          return;
        }

        const points = computeForecast(built.input);
        setEmptyMsg("");
        setData(points);
        return;

      }


      // lotto
      const draft: Model1DraftState | null = loadLottoDraft();
      if (!draft) {
        setEmptyMsg("Kein Lotto-Szenario gefunden. Bitte zuerst im Lotto-Rechner ausfüllen.");
        setData([]);
        return;
      }

      // retireAtAge from FinWF if available
      const profile = await loadProfile();
      if (!cancelled) setRetireAtAge(profile?.step1?.retireAtAge ?? 65);

      const selfAgeToday = baseYear - draft.household.self.birthYear;

      const input = forecastInputFromLottoDraft(draft, selfAgeToday, {
        type: "lotto",
        lumpSumCHF: lottoWin,
        atYearOffset: 0,
      });

      const points = computeForecast(input);
      setEmptyMsg("");
      setData(points);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [src, lottoWin]);


  /* =========================
     KPI: Tiefster Stand
     ========================= */
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

          {src === "lotto" ? (
            <a
              href="/app-static/lotto"
              className="mt-3 inline-block text-sm text-slate-200 underline decoration-slate-600 underline-offset-4"
            >
              Zum Lotto-Rechner
            </a>
          ) : (
            <a
              href="/app-static/finance"
              className="mt-3 inline-block text-sm text-slate-200 underline decoration-slate-600 underline-offset-4"
            >
              Zum Finance-Workflow
            </a>
          )}
        </div>
      ) : (
        <>
          <ForecastHeader
            src={src}
            minWealth={minWealth}
            minAge={minAge}
            lottoWin={lottoWin}
            setLottoWin={setLottoWin}
          />
          <ForecastChart data={data} retireAtAge={retireAtAge} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function ForecastHeader({
  src,
  minWealth,
  minAge,
  lottoWin,
  setLottoWin,
}: {
  src: "finance" | "lotto";
  minWealth: number | null;
  minAge: number | null;
  lottoWin: number;
  setLottoWin: (n: number) => void;
}) {
  const status = minWealth !== null && minWealth >= 0 ? "ok" : "risk";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-center">
      {/* LEFT */}
      <div className="flex items-start gap-4">
        <div className={`mt-1 h-4 w-4 rounded-full ${status === "ok" ? "bg-emerald-400" : "bg-rose-400"}`} />
        <div>
          <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
            {src === "finance" ? "Finance-Forecast" : "Lotto-Forecast"}
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

      {/* SCENARIO */}
      <div className="lg:justify-self-end lg:w-[320px]">
        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
          <div className="text-sm text-slate-400 mb-2">Szenario</div>

          {src === "lotto" ? (
            <>
              <div className="text-xs text-slate-400 mb-2">Lottogewinn (einmalig)</div>
              <MoneyInput
                label=" "
                value={lottoWin}
                onChange={(n: number) => setLottoWin(n)}
                suffix="CHF"
                size="short"
              />
            </>
          ) : (
            <div className="text-xs text-slate-500">Keine Overlay-Parameter im Finance-Forecast.</div>
          )}
        </div>
      </div>
    </div>
  );
}
