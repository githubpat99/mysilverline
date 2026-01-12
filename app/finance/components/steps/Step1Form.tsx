"use client";

import type { FormState } from "@/lib/types";
import FieldMoney from "../fields/FieldMoney";
import { todayBaseYear } from "@/lib/lotto/modelCFBW_HH.types";

type Step1Data = FormState["step1"];

function parseMoney(v?: string): number {
  if (!v) return 0;
  const s = v
    .replace(/CHF|chf/gi, "")
    .replace(/\s+/g, "")
    .replace(/'/g, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatCHF(n: number) {
  return n.toLocaleString("de-CH") + " CHF";
}

function yearFromISO(d?: string): number {
  if (!d || d.length < 4) return 0;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : 0;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function parseIntSafe(v: any, fallback: number) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

export default function Step1Form({
  value,
  onChange,
}: {
  value: Step1Data;
  onChange: (field: keyof Step1Data, value: string) => void;
}) {
  const liquidity =
    parseMoney(value.cash) +
    parseMoney(value.bankSavings) +
    parseMoney(value.securities);

  const longTerm = parseMoney(value.otherInvest);

  // Horizon
  const horizonYears = clamp(parseIntSafe((value as any).forecastHorizonYears, 55), 1, 120);

  // Birth/Age info
  const birthYear = yearFromISO(value.birthDate);
  // statt todayBaseYear überall direkt zu verwenden:
  const baseYear = todayBaseYear(); // <-- wichtig, call!
  const ageAtBase = birthYear ? Math.max(0, baseYear - birthYear) : 0;
  const endYear = baseYear + horizonYears;
  const endAge = birthYear ? ageAtBase + horizonYears : null;

  // Retire age (nur für Anzeige/Value)
  const retireAtAge = clamp(parseIntSafe((value as any).retireAtAge, 65), 50, 75);

  return (
  <div>
    <h2 className="text-base font-semibold text-slate-50">
      Schritt 1: Ausgangslage
    </h2>

    <p className="mt-2 text-sm text-slate-300">
      Trennung von Basisdaten, kurzfristiger Liquidität und langfristig gebundenem Vermögen.
    </p>

    {/* Kachel 1: Basics */}
    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-100">Basisdaten</div>

      {/* Geb.datum | Horizon | Pens.alter (Pens rechts) */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Geburtsdatum</label>
          <input
            type="date"
            value={value.birthDate ?? ""}
            onChange={(e) => onChange("birthDate", e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
          />
          <div className="mt-1 text-xs text-slate-500">
            {birthYear
              ? `Alter per 01.01.${baseYear}: ${ageAtBase}`
              : "Alter per 01.01. des laufenden Jahres"}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300">Forecast-Dauer (Jahre)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={String(horizonYears)}
            onChange={(e) => onChange("forecastHorizonYears" as any, e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
          />
          <div className="mt-1 text-xs text-slate-500">
            Ende: Jahr {endYear}
            {endAge !== null ? ` (ca. Alter ${endAge})` : ""}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300">Pensionierungsalter</label>
          <input
            type="number"
            min={50}
            max={75}
            value={String(retireAtAge)}
            onChange={(e) => onChange("retireAtAge", e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
          />
          <div className="mt-1 text-xs text-slate-500">Standard: 65</div>
        </div>
      </div>
    </div>

    {/* Kachel 2: Liquidität */}
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">Liquidität</div>
          <div className="text-xs text-slate-400">Kurzfristig verfügbar</div>
        </div>
        <div className="text-sm font-semibold text-slate-100">{formatCHF(liquidity)}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldMoney
          label="Bargeld / Sichtguthaben"
          value={value.cash}
          onChange={(v) => onChange("cash", v)}
        />
        <FieldMoney
          label="Bankguthaben"
          value={value.bankSavings}
          onChange={(v) => onChange("bankSavings", v)}
        />
        <FieldMoney
          label="Wertschriften"
          value={value.securities}
          onChange={(v) => onChange("securities", v)}
        />
      </div>
    </div>

    {/* Kachel 3: Langfristig */}
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">Langfristige Anlagen</div>
          <div className="text-xs text-slate-400">Gebundenes Vermögen</div>
        </div>
        <div className="text-sm font-semibold text-slate-100">{formatCHF(longTerm)}</div>
      </div>

      <FieldMoney
        label="Weitere Investitionen"
        value={value.otherInvest}
        onChange={(v) => onChange("otherInvest", v)}
      />
    </div>
  </div>
);
}