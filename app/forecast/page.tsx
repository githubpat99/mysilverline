"use client";
import { useEffect, useMemo, useState } from "react";

import ForecastChart from "./ForecastChart";
import type { YearBreakdown } from "@/lib/forecast/breakdown/types";
import { loadProfileV2 } from "@/lib/profileApiV2";
import type { ForecastPoint } from "@/lib/forecast";
import { computeForecastFromProfileV2 } from "@/lib/forecast/computeForecastFromProfileV2";

type StartAvail = { liq: number; kfr: number; available: number };

function parseMoney(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v)
    .trim()
    .replace(/CHF|chf/gi, "")
    .replace(/\s+/g, "")
    .replace(/'/g, "")
    .replace(/’/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatCHF(n: number): string {
  return `${n.toLocaleString("de-CH")} CHF`;
}

// Nur UI: versucht Step1/Step2 im Profile zu finden (ohne Forecast-Mapping anzutasten)
function deriveStartAvailable(profile: any): StartAvail {
  // >>> Hier sind die Kandidaten. Wenn es bei dir woanders liegt,
  // passe nur diese beiden Zeilen an. <<<
  const step1 =
    profile?.legacy?.step1 ??
    profile?.step1 ??
    profile?.basic ??
    profile?.financeBasic ??
    {};

  const step2 =
    profile?.legacy?.step2 ??
    profile?.step2 ??
    profile?.debts ??
    profile?.financeDebts ??
    {};

  const liq =
    parseMoney(step1.cash) +
    parseMoney(step1.bankSavings) +
    parseMoney(step1.securities);

  const kfr =
    parseMoney(step2.creditCard) +
    parseMoney(step2.consumerLoan) +
    parseMoney(step2.otherShort);

  return { liq, kfr, available: liq - kfr };
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastPoint[]>([]);
  const [emptyMsg, setEmptyMsg] = useState<string>("");
  const [retireAtAge, setRetireAtAge] = useState<number>(65);
  const [breakdowns, setBreakdowns] = useState<YearBreakdown[]>([]);
  const [openAge, setOpenAge] = useState<number | null>(null);

  const [startAvail, setStartAvail] = useState<StartAvail>({ liq: 0, kfr: 0, available: 0 });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const { ok, profile } = await loadProfileV2();

        console.log("[FC] profile keys:", Object.keys(profile as any));
        console.log("[FC] step1 candidates:", {
          step1: (profile as any).step1,
          legacyStep1: (profile as any).legacy?.step1,
          annuals: (profile as any).annuals,
          household: (profile as any).household,
          basic: (profile as any).basic,
        });
        console.log("[FC] step2 candidates:", {
          step2: (profile as any).step2,
          legacyStep2: (profile as any).legacy?.step2,
          debts: (profile as any).debts,
          basic: (profile as any).basic,
        });


        if (!ok || !profile) {
          setEmptyMsg("Profil noch nicht erfasst.");
          setData([]);
          setBreakdowns([]);
          return;
        }

        const self = profile.household.persons.find((p) => p.role === "self");
        setRetireAtAge(self?.retireAtAge ?? 65);

        // NEW: Ausgangslage (UI)
        const sa = deriveStartAvailable(profile as any);
        setStartAvail(sa);

        setEmptyMsg("");

        const out = computeForecastFromProfileV2(profile);
        if (cancelled) return;

        setData(out.points);
        setBreakdowns(out.breakdowns);

        setStartAvail({
          liq: out.liquidityToday,
          kfr: out.shortDebtToday,
          available: out.availabilityToday,
        });
        
      } catch (e) {
        console.error("[ForecastPage] load/compute failed:", e);
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setEmptyMsg(`Profil konnte nicht geladen werden. (${msg})`);
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
          <ForecastHeader minWealth={minWealth} minAge={minAge} startAvail={startAvail} />
          <div className="h-[320px]">
            <ForecastChart
              data={data}
              retireAtAge={retireAtAge}
              onSelectAge={(age) => setOpenAge(age)}
            />
            <BreakdownList
              breakdowns={breakdowns}
              openAge={openAge}
              setOpenAge={setOpenAge}
              startAvail={startAvail}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ForecastHeader({
  minWealth,
  minAge,
  startAvail,
}: {
  minWealth: number | null;
  minAge: number | null;
  startAvail: StartAvail;
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

      {/* RIGHT: Ausgangslage */}
      <div className="lg:justify-self-end lg:w-[320px]">
        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
          <div className="text-sm text-slate-400 mb-2">Ausgangslage (frei verfügbar)</div>
          <div className="flex items-baseline justify-between">
            <div className="text-xs text-slate-500">Liquidität − KFR</div>
            <div className="text-sm font-semibold text-slate-100">{formatCHF(startAvail.available)}</div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Liq: {formatCHF(startAvail.liq)} · KFR: {formatCHF(startAvail.kfr)}
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownList({
  breakdowns,
  openAge,
  setOpenAge,
  startAvail,
}: {
  breakdowns: YearBreakdown[];
  openAge: number | null;
  setOpenAge: (age: number | null) => void;
  startAvail: StartAvail;
}) {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!breakdowns.length) return;
    if (openAge === null) return;
    if (showAll) return;

    const inShown = breakdowns.slice(0, 5).some((b) => b.age === openAge);
    if (!inShown) setShowAll(true);
  }, [openAge, showAll, breakdowns]);

  if (!breakdowns.length) return null;

  const shown = showAll ? breakdowns : breakdowns.slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-300">Jahresübersicht</div>

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
        {shown.map((b) => {
          const eventsNet = b.totals.eventsNet ?? 0;
          const baseNet = b.totals.net - eventsNet;

          return (
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

                  <div className="text-xs text-slate-400 text-right">
                    {b.yearIndex === 0 && (
                      <>
                        Ausgangslage:{" "}
                        <span className="text-slate-200">{formatCHF(startAvail.available)}</span>
                        <span className="text-slate-500"> · </span>
                      </>
                    )}
                    Basis:{" "}
                    <span className="text-slate-200">{formatCHF(baseNet)}</span>
                    <span className="text-slate-500"> · </span>
                    Events:{" "}
                    <span className="text-slate-200">{formatCHF(eventsNet)}</span>
                    <span className="text-slate-500"> · </span>
                    Ende:{" "}
                    <span className="text-slate-200">
                      {b.wealthEnd.toLocaleString("de-CH")} CHF
                    </span>
                  </div>
                </div>
              </summary>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <BreakdownBlock title="Einkommen" lines={b.income} />
                <BreakdownBlock title="Ausgaben" lines={b.expenses} />
              </div>
            </details>
          );
        })}
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
