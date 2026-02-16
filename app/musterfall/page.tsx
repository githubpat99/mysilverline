"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadMusterfall } from "@/lib/musterfallApi";
import { saveProfileV2Safe } from "@/lib/profileApiV2";
import { savePositionsSafe } from "@/lib/positionsApi";
import { mapFormStateToProfileV2 } from "@/lib/mapping/mapFormStateToProfileV2";
import { mapFormStateToPositions } from "@/lib/mapping/mapFormStateToPositions";
import { mapV2ToFormState } from "@/lib/mapping/mapV2ToFormState";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";
import type { FormState } from "@/lib/types";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";

export default function MusterfallPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [adopting, setAdopting] = useState(false);

  useEffect(() => {
    loadMusterfall()
      .then((res) => {
        const mapped = mapV2ToFormState(res.profile as ProfileV2, res.positions as PositionDTO[]);
        setForm(mapped);
        setCanEdit(res.can_edit);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Musterfall konnte nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.body.classList.add("musterfall-scrollbar-hidden");
    document.documentElement.classList.add("musterfall-scrollbar-hidden");
    return () => {
      document.body.classList.remove("musterfall-scrollbar-hidden");
      document.documentElement.classList.remove("musterfall-scrollbar-hidden");
    };
  }, []);

  async function adoptAsMyProfile() {
    if (!form) return;
    setAdopting(true);
    setError(null);
    try {
      const profileV2 = mapFormStateToProfileV2(form, makeEmptyProfileV2());
      const positions = mapFormStateToPositions(form);
      const r = await saveProfileV2Safe(profileV2);
      if (!r.ok) throw new Error("Profil speichern fehlgeschlagen");
      const p = await savePositionsSafe(positions);
      if (!p.ok) throw new Error("Positionen speichern fehlgeschlagen");
      router.push("/finance");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen.");
    } finally {
      setAdopting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-slate-400">Musterfall wird geladen…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-rose-200">{error}</div>
          <Link href="/finance" className="mt-4 inline-block text-sky-400 hover:underline">
            ← Zurück zum Finanz-Workflow
          </Link>
        </div>
      </main>
    );
  }

  if (!form) return null;

  if (canEdit) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h1 className="text-xl font-semibold text-slate-100">Musterfall bearbeiten</h1>
            <p className="mt-2 text-slate-400">
              Sie sind der Inhaber des Musterfalls. Bearbeiten Sie Ihre Daten im Finanz-Workflow – diese werden automatisch als Beispiel für andere Nutzer angezeigt.
            </p>
            <Link
              href="/finance"
              className="mt-6 inline-block rounded-xl border border-sky-600 bg-sky-950/50 px-4 py-2 text-sky-200 hover:bg-sky-900/50"
            >
              Zum Finanz-Workflow →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const assets = form.step1?.positions ?? [];
  const debts = form.step2?.positions ?? [];
  const assetsTotal = assets.reduce((s, p) => s + (p.amountChf ?? 0), 0);
  const debtsTotal = debts.reduce((s, p) => s + (p.balanceChf ?? 0), 0);
  const income = form.step3?.annualsV2?.income?.[0]?.amountCHF ?? 0;
  const expense = form.step3?.annualsV2?.expense?.[0]?.amountCHF ?? 0;
  const events = form.step3?.events ?? [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Musterfall</h1>
            <p className="text-sm text-slate-400">Beispiel-Szenario. Sie können es als Vorlage übernehmen.</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/finance"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Zurück
            </Link>
            <button
              type="button"
              onClick={() => adoptAsMyProfile()}
              disabled={adopting}
              className="rounded-xl border border-sky-600 bg-sky-950/50 px-4 py-2 text-sm text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
            >
              {adopting ? "Übernehmen…" : "Als mein Profil übernehmen"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-2 text-rose-200">{error}</div>
        )}

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-sm font-semibold text-slate-200">Überblick</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-xl border border-slate-800 p-4">
                <div className="text-xs text-slate-500">Aktiven</div>
                <div className="text-lg font-semibold text-slate-100">{assetsTotal.toLocaleString("de-CH")} CHF</div>
              </div>
              <div className="rounded-xl border border-slate-800 p-4">
                <div className="text-xs text-slate-500">Passiven</div>
                <div className="text-lg font-semibold text-slate-100">{debtsTotal.toLocaleString("de-CH")} CHF</div>
              </div>
              <div className="rounded-xl border border-slate-800 p-4">
                <div className="text-xs text-slate-500">Jahreseinnahmen</div>
                <div className="text-lg font-semibold text-emerald-400">{income.toLocaleString("de-CH")} CHF</div>
              </div>
              <div className="rounded-xl border border-slate-800 p-4">
                <div className="text-xs text-slate-500">Jahresausgaben</div>
                <div className="text-lg font-semibold text-rose-400">{expense.toLocaleString("de-CH")} CHF</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-sm font-semibold text-slate-200">Aktiven ({assets.length})</h2>
            <ul className="mt-3 space-y-2">
              {assets.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-300">{p.label}{p.isSystem ? " (System)" : ""}</span>
                  <span className="text-slate-100">{(p.amountChf ?? 0).toLocaleString("de-CH")} CHF</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-sm font-semibold text-slate-200">Passiven ({debts.length})</h2>
            <ul className="mt-3 space-y-2">
              {debts.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-300">{p.label}{p.isSystem ? " (System)" : ""}</span>
                  <span className="text-slate-100">{(p.balanceChf ?? 0).toLocaleString("de-CH")} CHF</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-sm font-semibold text-slate-200">Ereignisse ({events.length})</h2>
            <ul className="mt-3 space-y-2">
              {events.slice(0, 10).map((e) => (
                <li key={e.client_id} className="flex justify-between text-sm">
                  <span className="text-slate-300">{e.title}</span>
                  <span className="text-slate-100">{(e.line?.amount_chf ?? 0).toLocaleString("de-CH")} CHF</span>
                </li>
              ))}
              {events.length > 10 && (
                <li className="text-slate-500">… und {events.length - 10} weitere</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
