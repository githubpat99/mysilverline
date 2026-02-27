"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadMusterfall } from "@/lib/musterfallApi";
import { saveProfile, savePositions } from "@/lib/services/dataService";
import { mapFormStateToProfileV2 } from "@/lib/mapping/mapFormStateToProfileV2";
import { mapFormStateToPositions } from "@/lib/mapping/mapFormStateToPositions";
import { mapV2ToFormState } from "@/lib/mapping/mapV2ToFormState";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";
import { whoAmI } from "@/lib/profileApi";
import TemplatePicker from "@/app/finance/components/TemplatePicker";
import type { FormState } from "@/lib/types";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";

export default function MusterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [musterfallForm, setMusterfallForm] = useState<FormState | null>(null);

  useEffect(() => {
    loadMusterfall()
      .then((res) => {
        setCanEdit(res.can_edit);
        if (!res.can_edit) {
          const form = mapV2ToFormState(res.profile as ProfileV2, res.positions as PositionDTO[]);
          setMusterfallForm(form);
        }
      })
      .catch(() => {
        setMusterfallForm(null);
      })
      .finally(() => setLoading(false));

    whoAmI()
      .then((me) => {
        const roles = Array.isArray(me.roles) ? me.roles : [];
        setIsAdmin(me.logged_in === true && roles.includes("administrator"));
      })
      .catch(() => setIsAdmin(false));
  }, []);

  async function handleSelect(form: FormState) {
    if (!window.confirm("Bestehende Daten werden überschrieben. Fortfahren?")) return;
    setError(null);
    try {
      const profileV2 = mapFormStateToProfileV2(form, makeEmptyProfileV2());
      const positions = mapFormStateToPositions(form);
      const r = await saveProfile(profileV2);
      if (!r.ok) throw new Error("Profil speichern fehlgeschlagen");
      const p = await savePositions(positions);
      if (!p.ok) throw new Error("Positionen speichern fehlgeschlagen");
      router.push("/finance");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-slate-400">Muster werden geladen…</p>
        </div>
      </main>
    );
  }

  if (canEdit) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h1 className="text-xl font-semibold text-slate-100">Musterfall bearbeiten</h1>
            <p className="mt-2 text-slate-400">
              Du bist der Inhaber des Musterfalls. Bearbeite deine Daten im Bereich Finanzen – diese werden automatisch als Beispiel für andere Nutzer angezeigt.
            </p>
            <Link
              href="/finance"
              className="mt-6 inline-block rounded-xl border border-sky-600 bg-sky-950/50 px-4 py-2 text-sky-200 hover:bg-sky-900/50"
            >
              Zu Finanzen →
            </Link>
            {isAdmin && (
              <div className="mt-4 rounded-lg border border-sky-800/60 bg-sky-950/30 px-4 py-3 text-sm text-sky-200">
                <div className="font-medium">Admin-Werkzeug</div>
                <div className="mt-1 text-sky-100/80">
                  User-Management (inkl. Löschhilfe für User + Datenabhängigkeiten):
                </div>
                <Link
                  href="/admin/user-management"
                  className="mt-2 inline-block rounded border border-sky-700/70 bg-sky-900/30 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-900/50"
                >
                  Admin User-Management öffnen →
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {error && (
        <div className="mx-auto max-w-4xl px-4 pt-6">
          <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm text-rose-200">{error}</div>
        </div>
      )}

      {isAdmin && (
        <div className="mx-auto max-w-4xl px-4 pt-6">
          <div className="rounded-lg border border-sky-800/60 bg-sky-950/30 px-4 py-3 text-sm text-sky-200">
            <div className="font-medium">Admin-Werkzeug</div>
            <div className="mt-1 text-sky-100/80">
              User-Management (inkl. Löschhilfe für User + Datenabhängigkeiten):
            </div>
            <Link
              href="/admin/user-management"
              className="mt-2 inline-block rounded border border-sky-700/70 bg-sky-900/30 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-900/50"
            >
              Admin User-Management öffnen →
            </Link>
          </div>
        </div>
      )}

      <TemplatePicker
        onSelect={handleSelect}
        title="Muster"
        subtitle="Wähle ein Szenario als Vorlage – bestehende Daten werden überschrieben."
        musterfallForm={musterfallForm}
      />
    </main>
  );
}
