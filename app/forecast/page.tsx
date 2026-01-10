"use client";
import { useEffect, useMemo, useState } from "react";

import ForecastChart from "./ForecastChart";
import type { YearBreakdown } from "@/lib/forecast/breakdown/types";
import { loadProfileV2 } from "@/lib/profileApiV2";
import type { ForecastPoint } from "@/lib/forecast";
import { computeForecastFromProfileV2 } from "@/lib/forecast/computeForecastFromProfileV2";

export default function ForecastPage() {
  const [data, setData] = useState<ForecastPoint[]>([]);
  const [emptyMsg, setEmptyMsg] = useState<string>("");
  const [retireAtAge, setRetireAtAge] = useState<number>(65);
  const [breakdowns, setBreakdowns] = useState<YearBreakdown[]>([]);
  const [openAge, setOpenAge] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const baseYear = new Date().getFullYear();

      try {
        const { ok, profile } = await loadProfileV2();
        if (!ok || !profile) {
          setEmptyMsg("Profil noch nicht erfasst.");
          setData([]);
          setBreakdowns([]);
          return;
        }

        console.log("[LOAD] annuals.indexation from API:", profile.annuals?.indexation);    // TODO PIN entfernen

        const self = profile.household.persons.find((p) => p.role === "self");
        setRetireAtAge(self?.retireAtAge ?? 65);

        setEmptyMsg("");

        const out = computeForecastFromProfileV2(profile);
        setData(out.points);
        setBreakdowns(out.breakdowns);

      } catch (e) {
        console.error(e);
        setEmptyMsg("Profil konnte nicht geladen werden.");
        setData([]);
        setBreakdowns([]);
      }
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
          <div className="h-[320px]">
            <ForecastChart
              data={data}
              retireAtAge={retireAtAge}
              onSelectAge={(age) => setOpenAge(age)}
            />
            <BreakdownList breakdowns={breakdowns} openAge={openAge} setOpenAge={setOpenAge} />
          </div>
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

function BreakdownList({
  breakdowns,
  openAge,
  setOpenAge,
}: {
  breakdowns: YearBreakdown[];
  openAge: number | null;
  setOpenAge: (age: number | null) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  // Wenn per Chart ein Jahr geöffnet wird,
  // das nicht in den letzten 5 liegt → automatisch "Mehr anzeigen"
  useEffect(() => {
    if (!breakdowns.length) return;
    if (openAge === null) return;
    if (showAll) return;

    const inShown = breakdowns.slice(0, 5).some((b) => b.age === openAge);
    if (!inShown) setShowAll(true);
  }, [openAge, showAll, breakdowns]);

  if (!breakdowns.length) return null;

  // Standard: nächste 5 Jahre ab heute
  const shown = showAll ? breakdowns : breakdowns.slice(0, 5);


  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-300">Details pro Jahr</div>

        {breakdowns.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-slate-200 underline decoration-slate-600 underline-offset-4"
          >
            {showAll ? "Weniger anzeigen" : `Mehr anzeigen (${breakdowns.length - 5})`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {shown.map((b) => (
          <details
            key={b.yearIndex}
            open={openAge === b.age}
            onToggle={(e) => {
              const el = e.currentTarget;
              if (el.open) setOpenAge(b.age);
              else if (openAge === b.age) setOpenAge(null);
            }}
            className="rounded-xl border border-slate-800 bg-slate-950/20 px-4 py-3"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-200">
                  Jahr {b.yearIndex} · Alter {b.age}
                </div>

                <div className="text-xs text-slate-400">
                  Net:{" "}
                  <span className="text-slate-200">
                    {b.totals.net.toLocaleString("de-CH")} CHF
                  </span>{" "}
                  · Ende:{" "}
                  <span className="text-slate-200">
                    {b.wealthEnd.toLocaleString("de-CH")} CHF
                  </span>
                </div>
              </div>
            </summary>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <BreakdownBlock title="Einkommen" lines={b.income} />
              <BreakdownBlock title="Ausgaben" lines={b.expenses} />
              <BreakdownBlock title="Schulden" lines={b.debts} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function BreakdownBlock({
  title,
  lines,
}: {
  title: string;
  lines: Array<{ label: string; amount: number }>;
}) {
  const sum = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-200">{title}</div>
        <div className="text-xs text-slate-400">{sum.toLocaleString("de-CH")} CHF</div>
      </div>

      <div className="mt-2 space-y-1">
        {lines.map((l, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="text-slate-400">{l.label}</div>
            <div className="text-slate-200">{l.amount.toLocaleString("de-CH")} CHF</div>
          </div>
        ))}
      </div>
    </div>
  );
}
