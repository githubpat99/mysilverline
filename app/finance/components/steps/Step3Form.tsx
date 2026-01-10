"use client";

import type { Step3Data } from "@/lib/types";
import MoneyInput from "@/app/lotto/components/MoneyInput";

// NEW: v2 events (adjust import path if needed)
import type { Event, EventRecurrence, EventLineType, EventIndexation } from "@/lib/types/v2/events";

type Props = {
  value: Step3Data;
  onChange: (next: Step3Data) => void;
};

const INDEXATION_OPTIONS: Array<{ value: Step3Data["indexation"]; label: string }> = [
  { value: "inflation", label: "mit Inflation" },
  { value: "fixed_real", label: "real konstant" },
  { value: "fixed_nominal", label: "nominal fix" },
];

const EVENT_RECURRENCE_OPTIONS: Array<{ value: EventRecurrence; label: string }> = [
  { value: "none", label: "einmalig (Startjahr)" },
  { value: "yearly", label: "jährlich" },
  { value: "monthly", label: "monatlich" },
];

const EVENT_TYPE_OPTIONS: Array<{ value: EventLineType; label: string }> = [
  { value: "income", label: "Einnahme" },
  { value: "spending", label: "Ausgabe" },
];

const EVENT_INDEXATION_OPTIONS: Array<{ value: EventIndexation | "none"; label: string }> = [
  { value: "none", label: "keine" },
  { value: "inflation", label: "mit Inflation" },
  { value: "fixed_real", label: "real konstant" },
  { value: "fixed_nominal", label: "nominal fix" },
];

function parseMoneyToNumber(s: string): number {
  return Number(String(s || "0").replace(/[’'\s]/g, "").replace(",", ".")) || 0;
}

function ymd(year: number, month: number, day: number) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function currentYear(): number {
  return new Date().getFullYear();
}

function makeClientId() {
  // stable enough for UI; you can replace with uuid later
  return `ui:event:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function makeEmptyEvent(): Event {
  const y = currentYear();
  return {
    client_id: makeClientId(),
    title: "Neues Ereignis",
    start_date: ymd(y, 1, 1),
    end_date: null,
    recurrence: "none",
    active: 1,
    meta_json: { notes: "" },
    line: {
      line_type: "income",
      amount_chf: 0,
      indexation: null,
      category: null,
      meta_json: null,
    },
  };
}

export default function Step3Form({ value, onChange }: Props) {

  const events: Event[] = value.events ?? [];
  function setEvents(next: Event[]) {
    onChange({ ...value, events: next });
  }

  function addEvent() {
    setEvents([...(events ?? []), makeEmptyEvent()]);
  }

  function deleteEvent(client_id: string) {
    setEvents((events ?? []).filter((e) => e.client_id !== client_id));
  }

  function updateEvent(client_id: string, patch: Partial<Event>) {
    setEvents(
      (events ?? []).map((e) => (e.client_id === client_id ? { ...e, ...patch } : e)),
    );
  }

  function updateEventLine(client_id: string, patch: Partial<Event["line"]>) {
    setEvents(
      (events ?? []).map((e) =>
        e.client_id === client_id ? { ...e, line: { ...e.line, ...patch } } : e,
      ),
    );
  }

  function cloneEvent(client_id: string) {
    const src = (events ?? []).find((e) => e.client_id === client_id);
    if (!src) return;
    const copy: Event = {
      ...src,
      id: undefined,
      client_id: makeClientId(),
      title: `${src.title} (Kopie)`,
      // keep meta_json/line/meta_json as-is
    };
    setEvents([...(events ?? []), copy]);
  }

  return (
    <div className="space-y-6">
      {/* --- Annuals / Basis --- */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="text-sm font-semibold text-slate-100">Jährliche Basis</div>
        <div className="mt-1 text-xs text-slate-500">
          Diese Werte werden im Finance-Forecast als Grundmodell verwendet.
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Jahreseinnahmen heute (gesamt)"
            value={parseMoneyToNumber(value.annualIncomeToday)}
            onChange={(n: number) => onChange({ ...value, annualIncomeToday: String(Math.trunc(n)) })}
            suffix="CHF"
            size="short"
          />

          <MoneyInput
            label="Jahresausgaben heute (gesamt)"
            value={parseMoneyToNumber(value.annualSpendingToday)}
            onChange={(n: number) => onChange({ ...value, annualSpendingToday: String(Math.trunc(n)) })}
            suffix="CHF"
            size="short"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-slate-400">Indexierung</label>
          <select
            value={value.indexation ?? "inflation"}
            onChange={(e) => onChange({ ...value, indexation: e.target.value as Step3Data["indexation"] })}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
          >
            {INDEXATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* divider */}
      <div className="h-px w-full bg-slate-800/70" />

      {/* --- Events (Cards) --- */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Ereignisse</div>
            <div className="mt-1 text-xs text-slate-500">
              Jahresbasiert (none/yearly/monthly) mit Start-/Enddatum (wir berücksichtigen vorerst nur Start-/Endjahr).
            </div>
          </div>

          <button
            type="button"
            onClick={addEvent}
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900"
          >
            + Ereignis
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {events.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
              Keine Ereignisse erfasst.
            </div>
          ) : (
            events.map((e) => (
              <div key={e.client_id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                {/* header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <input
                      value={e.title ?? ""}
                      onChange={(ev) => updateEvent(e.client_id, { title: ev.target.value })}
                      className="w-full truncate rounded-lg border border-slate-800 bg-slate-950/30 px-2 py-1 text-sm font-medium text-slate-100"
                      placeholder="Titel"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{e.line?.line_type === "income" ? "Einnahme" : "Ausgabe"}</span>
                      <span>·</span>
                      <span>{e.recurrence}</span>
                      <span>·</span>
                      <span>
                        {e.start_date?.slice(0, 4)}
                        {e.end_date ? `–${e.end_date.slice(0, 4)}` : "–offen"}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-slate-200 underline decoration-slate-600 underline-offset-4"
                      onClick={() => cloneEvent(e.client_id)}
                    >
                      Dupl.
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-300 underline decoration-red-700/60 underline-offset-4"
                      onClick={() => deleteEvent(e.client_id)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>

                {/* body */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Typ</label>
                    <select
                      value={e.line?.line_type ?? "income"}
                      onChange={(ev) => updateEventLine(e.client_id, { line_type: ev.target.value as EventLineType })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    >
                      {EVENT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <MoneyInput
                    label="Betrag (CHF)"
                    value={Math.trunc(e.line?.amount_chf ?? 0)}
                    onChange={(n: number) => updateEventLine(e.client_id, { amount_chf: Math.trunc(n) })}
                    suffix="CHF"
                    size="short"
                  />

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Startdatum</label>
                    <input
                      type="date"
                      value={e.start_date ?? ""}
                      onChange={(ev) => updateEvent(e.client_id, { start_date: ev.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Enddatum (optional)</label>
                    <input
                      type="date"
                      value={e.end_date ?? ""}
                      onChange={(ev) => updateEvent(e.client_id, { end_date: ev.target.value || null })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    />
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => updateEvent(e.client_id, { end_date: null })}
                        className="text-xs text-slate-300 underline decoration-slate-600 underline-offset-4"
                      >
                        Enddatum leeren (offen)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Wiederholung</label>
                    <select
                      value={e.recurrence ?? "none"}
                      onChange={(ev) => updateEvent(e.client_id, { recurrence: ev.target.value as EventRecurrence })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    >
                      {EVENT_RECURRENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Indexierung (Event)</label>
                    <select
                      value={(e.line?.indexation ?? "none") as any}
                      onChange={(ev) =>
                        updateEventLine(e.client_id, {
                          indexation: (ev.target.value === "none" ? null : (ev.target.value as EventIndexation)),
                        })
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                    >
                      {EVENT_INDEXATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-slate-400">Notizen (optional)</label>
                    <textarea
                      value={(e.meta_json?.notes ?? "") as string}
                      onChange={(ev) =>
                        updateEvent(e.client_id, { meta_json: { ...(e.meta_json ?? {}), notes: ev.target.value } })
                      }
                      rows={3}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
                      placeholder="z.B. Autokauf 2027, Renovation, Erbschaft, Bonus, ..."
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
