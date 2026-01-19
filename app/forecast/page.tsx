// app/forecast/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { loadProfileV2 } from "@/lib/profileApiV2";
import { runForecast } from "@/lib/forecast/runForecast";
import { formatCHF } from "@/lib/format";
import type { ProfileV2 } from "@/lib/types/v2";

function toNumberCHF(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object") {
    const any = v as any;
    if (typeof any.amount === "number") return any.amount;
    if (typeof any.amount === "string") return toNumberCHF(any.amount);
    if (typeof any.value === "number") return any.value;
    if (typeof any.value === "string") return toNumberCHF(any.value);
  }
  return 0;
}

export default function ForecastPage() {
  const [profile, setProfile] = useState<ProfileV2 | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await loadProfileV2();
        const p = (r as any)?.profile ?? r; // unwrap wie Summary
        if (!p) {
          setProfile(null);
          return;
        }
        setProfile(p as ProfileV2);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fc = useMemo(() => (profile ? runForecast(profile) : null), [profile]);
  const rows = fc?.rows ?? [];
const startYear = rows[0]?.year ?? new Date().getFullYear();
const horizonYears = rows.length;


  const last = useMemo(
    () => fc?.rows?.[fc.rows.length - 1] ?? null,
    [fc]
  );

  if (loading) {
    return <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">Lade Forecast…</main>;
  }

  if (!profile || !fc) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-sky-400">Forecast</h1>
          <p className="mt-4 text-slate-300">
            Keine DB-Daten gefunden oder nicht eingeloggt. Bitte zuerst im Workflow speichern.
          </p>
          <div className="mt-6">
            <Link href="/finance" className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500">
              Zum Finanz-Workflow
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-sky-400">Forecast</h1>
            <p className="mt-2 text-sm text-slate-300">
              {fc.startYear}–{startYear + horizonYears - 1}
            </p>
          </div>

          {last ? (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-slate-400">Nettovermögen (Ende)</div>
              <div className="mt-1 text-2xl font-semibold text-slate-50">
                {formatCHF(toNumberCHF(last.netWorthEnd))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-base font-semibold text-slate-50">Jahresübersicht</h2>
          <p className="mt-1 text-sm text-slate-300">
            Liquidität / Short / Long / Real / Debt und Netto pro Jahresende.
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Jahr</th>
                  <th className="px-3 py-2 text-right">Liq</th>
                  <th className="px-3 py-2 text-right">Short</th>
                  <th className="px-3 py-2 text-right">Long</th>
                  <th className="px-3 py-2 text-right">Real</th>
                  <th className="px-3 py-2 text-right">Debt</th>
                  <th className="px-3 py-2 text-right">Netto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/20 text-slate-200">
                {rows.map((r) => (
                  <tr key={r.year}>
                    <td className="px-3 py-2">{r.year}</td>
                    <td className="px-3 py-2 text-right">{formatCHF(toNumberCHF(r.end.liquidity))}</td>
                    <td className="px-3 py-2 text-right">{formatCHF(toNumberCHF(r.end.short))}</td>
                    <td className="px-3 py-2 text-right">{formatCHF(toNumberCHF(r.end.long))}</td>
                    <td className="px-3 py-2 text-right">{formatCHF(toNumberCHF(r.end.real))}</td>
                    <td className="px-3 py-2 text-right">{formatCHF(toNumberCHF(r.end.debt))}</td>
                    <td className="px-3 py-2 text-right">{formatCHF(toNumberCHF(r.netWorthEnd))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* optional: small KPI row */}
          {last ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Kpi label="Asset-Cashflow p.a." value={formatCHF(toNumberCHF(last.assetCashflow))} />
              <Kpi label="Zinsen p.a." value={formatCHF(toNumberCHF(last.debtInterest))} />
              <Kpi label="Amortisation p.a." value={formatCHF(toNumberCHF(last.debtAmort))} />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-50">{value}</div>
    </div>
  );
}
