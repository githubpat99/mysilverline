"use client";

import Link from "next/link";

export default function ReleasesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="text-2xl font-semibold text-slate-100">Release Notes</h1>
          <p className="mt-2 text-sm text-slate-400">
            Hier findest du die wichtigsten Aenderungen pro Version.
          </p>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-slate-100">Version 0.8</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Forecast-Verbesserungen, Autosave-Basis, Sync-Absicherung beim Login, Musterfall-Updates.
                </p>
              </div>
              <Link
                href="/releases/0-8"
                className="shrink-0 rounded-lg border border-sky-600/60 bg-sky-950/40 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-900/50"
              >
                Vollstaendige Notes
              </Link>
            </div>
          </div>

          <div className="mt-6 text-sm text-slate-500">Weitere Releases folgen fortlaufend pro Minor-Version.</div>

          <div className="mt-6">
            <Link
              href="/base"
              className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Zurueck zu Basis
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

