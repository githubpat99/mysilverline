"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/services/dataService";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";
import type { ProfileV2 } from "@/lib/types/v2";
import type { Person, PersonRole } from "@/lib/types/v2/household";


function yyyy() {
    return new Date().getFullYear();
}

const ROLE_SELF: PersonRole = "self";

function ensureSelf(profile: ProfileV2 | null): ProfileV2 {
    const p = profile ?? makeEmptyProfileV2();

    const persons: Person[] = p.household?.persons ?? [];

    const idx = persons.findIndex((x) => x.role === ROLE_SELF || x.id === "self");

    const selfPerson: Person =
        idx >= 0
            ? persons[idx]
            : {
                id: "self",
                role: ROLE_SELF,
                birthDate: "",
                // retireAtAge ist optional => weglassen oder undefined
            };

    const nextPersons: Person[] = idx >= 0 ? persons : [selfPerson, ...persons];

    return {
        ...p,
        household: { ...(p.household ?? {}), persons: nextPersons },
        meta: {
            ...(p.meta ?? {}),
            startYear: yyyy(),
            forecastHorizonYears: p.meta?.forecastHorizonYears ?? 55,
        },
    };
}

export default function BaseForm() {
    const [profile, setProfile] = useState<ProfileV2 | null>(null);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const dirtyRef = useRef(false);
    const committingRef = useRef(false);

    const [loaded, setLoaded] = useState(false);
    function markDirty() {
        dirtyRef.current = true;
    }


    useEffect(() => {
        (async () => {
            setErr("");
            try {
                const r = await loadProfile();
                if (!r.ok) {
                    setErr("Konnte Profil nicht laden (API- oder Parse-Fehler).");
                    setProfile(ensureSelf(makeEmptyProfileV2()));
                } else {
                    setProfile(ensureSelf(r.profile ?? makeEmptyProfileV2()));
                }
            } catch (e) {
                console.error("[BaseForm] load failed", e);
                setErr("Konnte Profil nicht laden.");
                setProfile(ensureSelf(makeEmptyProfileV2()));
            } finally {
                setLoaded(true);
            }
        })();
    }, []);

    const self = useMemo(() => {
        const persons: Person[] = profile?.household?.persons ?? [];
        return persons.find((p) => p.role === ROLE_SELF || p.id === "self");
    }, [profile]);

    if (!loaded || !profile || !self) return <div className="p-4 text-slate-400">Lade…</div>;

    const startYear = yyyy();
    const forecastHorizonYears = profile.meta?.forecastHorizonYears ?? 55;

    function patchSelf(patch: Partial<Person>) {
        markDirty();
        setProfile((prev) => {
            if (!prev) return prev;
            const persons: Person[] = prev.household?.persons ?? [];
            const nextPersons = persons.map((p) =>
                p.role === ROLE_SELF || p.id === "self" ? ({ ...p, ...patch } as Person) : p
            );
            return { ...prev, household: { ...(prev.household ?? {}), persons: nextPersons } };
        });
    }

    function patchMeta(patch: Partial<ProfileV2["meta"]>) {
        markDirty();
        setProfile((prev) => {
            if (!prev) return prev;
            return { ...prev, meta: { ...(prev.meta ?? {}), ...patch } };
        });
    }

    function toDateInputValue(iso?: string) {
        // erwartet "YYYY-MM-DD"
        if (!iso) return "";
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
    }

    function fromDateInputValue(v: string) {
        // v ist bei <input type="date"> bereits "YYYY-MM-DD" oder ""
        return v.trim();
    }


    async function onSave() {
        setErr("");

        const p = profile;
        const s = self;

        if (!p || !s) {
            setErr("Profil ist nicht vollständig geladen.");
            return;
        }

        // ab hier: p und s sind NICHT undefined/null
        const bd = s.birthDate.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
            setErr("Geburtsdatum muss gesetzt sein.");
            return;
        }

        const hy = Number(p.meta.forecastHorizonYears ?? 0);
        if (!Number.isFinite(hy) || hy < 1 || hy > 120) {
            setErr("Forecast-Horizont muss zwischen 1 und 120 liegen.");
            return;
        }

        const ra = s.retireAtAge;
        if (typeof ra !== "undefined") {
            if (!Number.isFinite(ra) || ra < 40 || ra > 80) {
                setErr("Rentenalter (falls gesetzt) muss zwischen 40 und 80 liegen.");
                return;
            }
        }

        setSaving(true);
        try {
            const startYear = yyyy();

            const toSave: ProfileV2 = {
                ...p,
                meta: {
                    ...p.meta,
                    startYear,
                    forecastHorizonYears: hy,
                    description:
                        typeof p.meta?.description === "string" && p.meta.description.trim()
                            ? p.meta.description.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
                            : undefined,
                },
                household: {
                    ...p.household,
                    persons: p.household.persons.map((person) =>
                        person.role === ROLE_SELF || person.id === "self"
                            ? { ...person, birthDate: bd, ...(typeof ra === "number" ? { retireAtAge: ra } : {}) }
                            : person
                    ),
                },
            };

            const r = await saveProfile(toSave);

            if (!r.ok) {
                setErr(r.status === 401 || r.status === 403 ? "Nicht eingeloggt / Nonce." : "Speichern fehlgeschlagen.");
                return;
            }

            if (r.profile) setProfile(ensureSelf(r.profile));
            else {
                const rr = await loadProfile();
                if (rr.ok) setProfile(ensureSelf(rr.profile));
            }
        } finally {
            setSaving(false);
        }
    }

    async function commitIfDirty() {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;

        if (committingRef.current) return;
        committingRef.current = true;
        try {
            await onSave();
        } finally {
            committingRef.current = false;
        }
    }

    return (
        <div
            className="mx-auto max-w-3xl px-4 py-6"
            onBlurCapture={(e) => {
                const next = e.relatedTarget as Node | null;
                if (next && e.currentTarget.contains(next)) return;
                void commitIfDirty();
            }}
        >
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-extrabold">Basis</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Person und Forecast-Horizont definieren.
                    </p>
                </div>
                <div className="text-xs text-slate-500">
                    {saving ? "Speichert…" : "Autosave aktiv"}
                </div>
            </div>

            {err && (
                <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                    {err}
                </div>
            )}

            {/* Form grid */}
            <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <label>
                    <div className="mb-1 text-xs text-slate-400">Geburtsdatum *</div>
                    <input
                        type="date"
                        value={toDateInputValue(self.birthDate)}
                        onChange={(e) => patchSelf({ birthDate: fromDateInputValue(e.target.value) })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    />
                </label>

                <label>
                    <div className="mb-1 text-xs text-slate-400">Rentenalter (optional)</div>
                    <input
                        value={typeof self.retireAtAge === "number" ? String(self.retireAtAge) : ""}
                        onChange={(e) => {
                            const s = e.target.value.trim();
                            patchSelf({ retireAtAge: s === "" ? undefined : Number(s) });
                        }}
                        placeholder="z.B. 65"
                        inputMode="numeric"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    />
                </label>

                <label>
                    <div className="mb-1 text-xs text-slate-400">Forecast-Horizont (1–120) *</div>
                    <input
                        value={String(forecastHorizonYears)}
                        onChange={(e) => patchMeta({ forecastHorizonYears: Number(e.target.value || 0) })}
                        inputMode="numeric"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    />
                </label>

                <label>
                    <div className="mb-1 text-xs text-slate-400">Startjahr (fix)</div>
                    <input
                        value={String(startYear)}
                        disabled
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-400 opacity-70"
                    />
                </label>

                <label className="sm:col-span-2">
                    <div className="mb-1 text-xs text-slate-400">Fallbeschreibung (optional)</div>
                    <textarea
                        value={profile.meta?.description ?? ""}
                        onChange={(e) => patchMeta({ description: e.target.value || undefined })}
                        rows={3}
                        placeholder="z.B. Familie mit Eigenheim und Hypothek"
                        className="w-full resize-vertical rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    />
                </label>
            </div>

            {/* Über Silverline */}
            <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-5">
                <h2 className="text-base font-semibold text-slate-200">Über Silverline</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Silverline hilft dir, deine Finanzen transparent darzustellen und daraus
                    Rückschlüsse für deine finanzielle Vorsorge zu gewinnen.
                </p>

                <ol className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <li className="flex items-start gap-2 text-slate-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-400">1</span>
                        <span><strong className="text-slate-100">Bilanz erstellen</strong> – Vermögen, Schulden, Liquidität</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-400">2</span>
                        <span><strong className="text-slate-100">Zukunft planen</strong> – Forecast, Pensionierung, Ziele</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-400">3</span>
                        <span><strong className="text-slate-100">Justieren</strong> – Sparrate, Risiko, Liquidität</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-400">4</span>
                        <span><strong className="text-slate-100">Wiederholen</strong> – Regelmässig prüfen und anpassen</span>
                    </li>
                </ol>

                <p className="mt-4 text-sm text-slate-500">
                    Mehr erfahren auf{" "}
                    <a
                        href="https://mysilverline.it-pin.ch"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 underline underline-offset-2 hover:text-sky-300 transition"
                    >
                        mysilverline.it-pin.ch
                    </a>
                    {" "}·{" "}
                    <a
                        href="/releases/0-8"
                        className="text-sky-400 underline underline-offset-2 hover:text-sky-300 transition"
                    >
                        Silverline Rel. 0.8
                    </a>
                    <span className="ml-1 text-xs text-slate-600">(25.02.2026)</span>
                </p>
            </section>
        </div>
    );
}
