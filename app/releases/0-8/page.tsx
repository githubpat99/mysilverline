"use client";

import Link from "next/link";

export default function Release08Page() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="text-2xl font-semibold text-slate-100">Release 0.8</h1>
          <p className="mt-1 text-sm text-slate-400">Release-Datum: 2026-02-25</p>

          <h2 className="mt-6 text-lg font-medium text-slate-100">Highlights</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Forecast: zweite Linie fuer Liquiditaet inklusive Warnungsbezug.</li>
            <li>Basis-Form mit konsistentem Autosave ohne separaten Speichern-Button.</li>
            <li>Login-Sync abgesichert: beim Login nur Pull, kein automatischer Push.</li>
            <li>Musterfall-Updates inklusive gezieltem Liquiditaetsengpass 2029.</li>
            <li>Terminologie und Texte weiter auf Du-Form harmonisiert.</li>
          </ul>

          <h2 className="mt-6 text-lg font-medium text-slate-100">Wichtige Aenderungen</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Neue KPI: Delta Liquiditaet im Zeitraum im Forecast-Header.</li>
            <li>Hinweis vor Logout bei nicht synchronisierten lokalen Aenderungen.</li>
            <li>Template "Familie 30+": Ausgaben auf 110&apos;000 CHF und Event in 2029.</li>
            <li>Alle Templates laufen nun bis Alter 80.</li>
          </ul>

          <div className="mt-8">
            <Link
              href="/releases"
              className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Zurueck zu Release Notes
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

