"use client";

import { useEffect, useMemo, useState } from "react";
import { loadProfileV2, saveProfileV2Safe } from "@/lib/profileApiV2";
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

    useEffect(() => {
        (async () => {
            setErr("");
            const r = await loadProfileV2();
            if (!r.ok) {
                setErr("Konnte Profil nicht laden.");
                return;
            }
            setProfile(ensureSelf(r.profile));
        })();
    }, []);

    const self = useMemo(() => {
        const persons: Person[] = profile?.household?.persons ?? [];
        return persons.find((p) => p.role === ROLE_SELF || p.id === "self");
    }, [profile]);

    if (!profile || !self) return <div style={{ padding: 16, color: "#94a3b8" }}>Lade…</div>;

    const startYear = yyyy();
    const forecastHorizonYears = profile.meta?.forecastHorizonYears ?? 55;

    function patchSelf(patch: Partial<Person>) {
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
                meta: { ...p.meta, startYear, forecastHorizonYears: hy },
                household: {
                    ...p.household,
                    persons: p.household.persons.map((person) =>
                        person.role === ROLE_SELF || person.id === "self"
                            ? { ...person, birthDate: bd, ...(typeof ra === "number" ? { retireAtAge: ra } : {}) }
                            : person
                    ),
                },
            };

            const r = await saveProfileV2Safe(toSave);

            if (!r.ok) {
                setErr(r.status === 401 || r.status === 403 ? "Nicht eingeloggt / Nonce." : "Speichern fehlgeschlagen.");
                return;
            }

            if (r.profile) setProfile(ensureSelf(r.profile));
            else {
                const rr = await loadProfileV2();
                if (rr.ok) setProfile(ensureSelf(rr.profile));
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ maxWidth: 820, margin: "0 auto", padding: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>Basis</h1>
            <p style={{ color: "#64748b", marginTop: 6 }}>
                Startjahr ist fix (aktuelles Jahr). Hier definierst du nur Person und Forecast-Horizont.
            </p>

            {err ? (
                <div style={{ marginTop: 12, padding: 10, border: "1px solid #7f1d1d", borderRadius: 10, color: "#fecaca" }}>
                    {err}
                </div>
            ) : null}

            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                <label>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Startjahr (fix)</div>
                    <input value={String(startYear)} disabled style={{ width: "100%", padding: 10, borderRadius: 10, opacity: 0.7 }} />
                </label>

                <label>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                        Geburtsdatum *
                    </div>
                    <input
                        type="date"
                        value={toDateInputValue(self.birthDate)}
                        onChange={(e) => patchSelf({ birthDate: fromDateInputValue(e.target.value) })}
                        style={{ width: "100%", padding: 10, borderRadius: 10 }}
                    />
                </label>


                <label>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Rentenalter (optional)</div>
                    <input
                        value={typeof self.retireAtAge === "number" ? String(self.retireAtAge) : ""}
                        onChange={(e) => {
                            const s = e.target.value.trim();
                            patchSelf({ retireAtAge: s === "" ? undefined : Number(s) });
                        }}
                        style={{ width: "100%", padding: 10, borderRadius: 10 }}
                        placeholder="z.B. 65"
                        inputMode="numeric"
                    />
                </label>

                <label>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Forecast-Horizont (1–120) *</div>
                    <input
                        value={String(forecastHorizonYears)}
                        onChange={(e) => patchMeta({ forecastHorizonYears: Number(e.target.value || 0) })}
                        style={{ width: "100%", padding: 10, borderRadius: 10 }}
                        inputMode="numeric"
                    />
                </label>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <a href="/app-static/finance" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #334155", textDecoration: "none" }}>
                        Zum Workflow
                    </a>
                    <button
                        onClick={onSave}
                        disabled={saving}
                        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #0ea5e9", background: "rgba(14,165,233,0.12)" }}
                    >
                        {saving ? "Speichern…" : "Speichern"}
                    </button>
                </div>
            </div>
        </div>
    );
}
