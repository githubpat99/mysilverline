"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ANALYTICS_DASHBOARD_URL,
  ANALYTICS_ENABLED,
  ANALYTICS_SCRIPT_URL,
  ANALYTICS_WEBSITE_ID,
} from "@/lib/config";
import { whoAmI } from "@/lib/profileApi";

export default function AdminAnalyticsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    whoAmI()
      .then((me) => {
        if (!alive) return;
        const roles = Array.isArray(me.roles) ? me.roles : [];
        setAllowed(me.logged_in === true && roles.includes("administrator"));
      })
      .catch(() => {
        if (alive) setAllowed(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (allowed === null) {
    return (
      <main className="bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-8 text-slate-400">Prüfe Berechtigung…</div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/30 p-6">
            <h1 className="text-lg font-semibold text-rose-200">Kein Zugriff</h1>
            <p className="mt-2 text-sm text-slate-300">
              Diese Seite ist nur für Administratoren verfügbar.
            </p>
            <Link href="/musterfall" className="mt-4 inline-block text-sm text-sky-300 hover:text-sky-200">
              Zurück zu Muster →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-4 sm:space-y-4 sm:py-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
          <h1 className="text-xl font-semibold text-slate-100">Admin: Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Interne KPI-Übersicht für App-Nutzung und direkte Navigation zum Dashboard.
          </p>

          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:mt-4 sm:p-4">
            <div className="text-sm text-slate-300">
              Status:{" "}
              <span className={ANALYTICS_ENABLED ? "text-emerald-300" : "text-rose-300"}>
                {ANALYTICS_ENABLED ? "Analytics aktiv" : "Analytics nicht aktiv"}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 truncate">
              Website-ID: {ANALYTICS_WEBSITE_ID || "nicht gesetzt"}
            </div>
            <div className="mt-1 hidden text-xs text-slate-500 sm:block">
              Script: {ANALYTICS_SCRIPT_URL}
            </div>
          </div>

          <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:mt-4 sm:p-4">
            <summary className="cursor-pointer list-none text-base font-medium text-slate-100">
              Beta-Scorecard (Woche)
            </summary>
            <p className="mt-1 text-sm text-slate-400">
              Zeitraum auf "Last 7 days" setzen und die Kennzahlen jede Woche gleich vergleichen.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-300">
                  <tr>
                    <th className="border-b border-slate-800 px-2 py-2 font-medium">KPI</th>
                    <th className="border-b border-slate-800 px-2 py-2 font-medium">Formel</th>
                    <th className="border-b border-slate-800 px-2 py-2 font-medium">Zielwert</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr>
                    <td className="border-b border-slate-900 px-2 py-2 text-slate-200">WAU</td>
                    <td className="border-b border-slate-900 px-2 py-2">User mit `app_open` / Woche</td>
                    <td className="border-b border-slate-900 px-2 py-2">steigend WoW</td>
                  </tr>
                  <tr>
                    <td className="border-b border-slate-900 px-2 py-2 text-slate-200">Activation</td>
                    <td className="border-b border-slate-900 px-2 py-2">`login_success / app_open`</td>
                    <td className="border-b border-slate-900 px-2 py-2">&gt; 60%</td>
                  </tr>
                  <tr>
                    <td className="border-b border-slate-900 px-2 py-2 text-slate-200">Sync-Adoption</td>
                    <td className="border-b border-slate-900 px-2 py-2">`sync_clicked / login_success`</td>
                    <td className="border-b border-slate-900 px-2 py-2">&gt; 50%</td>
                  </tr>
                  <tr>
                    <td className="border-b border-slate-900 px-2 py-2 text-slate-200">Sync-Erfolg</td>
                    <td className="border-b border-slate-900 px-2 py-2">`sync_success / sync_clicked`</td>
                    <td className="border-b border-slate-900 px-2 py-2">&gt; 90%</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 text-slate-200">Fehlerquote</td>
                    <td className="px-2 py-2">`sync_failed / sync_clicked`</td>
                    <td className="px-2 py-2">&lt; 5%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>

          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
            <a
              href={ANALYTICS_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-sky-600/60 bg-sky-950/40 px-3 py-2 text-sm text-sky-200 hover:bg-sky-900/50"
            >
              Umami Dashboard öffnen
            </a>
            <Link
              href="/admin/user-management"
              className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60"
            >
              Zurück zu Admin-Werkzeugen
            </Link>
            <Link href="/musterfall" className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-200">
              Zurück zu Muster
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
