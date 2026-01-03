"use client";

import type { FormState } from "@/lib/types";
import FieldMoney from "../fields/FieldMoney";

type Step1Data = FormState["step1"];

export default function Step1Form({
  value,
  onChange,
}: {
  value: Step1Data;
  onChange: (field: keyof Step1Data, value: string) => void;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-50">
        Schritt 1: Ausgangslage deiner Finanzen
      </h2>

      <p className="mt-2 text-sm text-slate-300">
        Erfasse hier grob deine aktuellen Vermögenswerte. Das dient als Basis für
        Liquiditäts- und Anlagestrategie.
      </p>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Geburtsdatum</label>
        <input
          type="date"
          value={value.birthDate ?? ""}
          onChange={(e) => onChange("birthDate", e.target.value)}
          className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
        />
        <div className="mt-1 text-xs text-slate-500">
          Alter wird per 01.01. des laufenden Jahres berechnet.
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">Pensionierungsalter</label>
        <input
          type="number"
          min={50}
          max={75}
          value={value.retireAtAge ?? "65"}
          onChange={(e) => onChange("retireAtAge", e.target.value)} // KEIN Fallback erzwingen
          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
        />
        <p className="mt-1 text-xs text-slate-500">Standard: 65</p>

        <FieldMoney
          label="Bargeld / Sichtguthaben"
          value={value.cash}
          onChange={(v) => onChange("cash", v)}
        />
        <FieldMoney
          label="Bankguthaben (Sparen)"
          value={value.bankSavings}
          onChange={(v) => onChange("bankSavings", v)}
        />
        <FieldMoney
          label="Wertschriften (ETF, Aktien, Fonds)"
          value={value.securities}
          onChange={(v) => onChange("securities", v)}
        />
        <FieldMoney
          label="Weitere Investitionen"
          value={value.otherInvest}
          onChange={(v) => onChange("otherInvest", v)}
        />
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-300">
        Tipp: Wenn du unsicher bist, nimm eine grobe Schätzung. Du kannst später
        jeden Schritt wieder öffnen und anpassen.
      </div>
    </div>
  );
}
