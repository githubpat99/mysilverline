"use client";

import type { FormState } from "@/lib/types";
import FieldMoney from "../fields/FieldMoney";

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
        <div className="text-sm font-semibold text-slate-100 mb-3">Basisdaten</div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Geburtsdatum</label>
            <input
              type="date"
              value={value.birthDate ?? ""}
              onChange={(e) => onChange("birthDate", e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
            />
            <div className="mt-1 text-xs text-slate-500">
              Alter per 01.01. des laufenden Jahres
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Pensionierungsalter
            </label>
            <input
              type="number"
              min={50}
              max={75}
              value={value.retireAtAge ?? "65"}
              onChange={(e) => onChange("retireAtAge", e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
            />
            <div className="mt-1 text-xs text-slate-500">Standard: 65</div>
          </div>
        </div>
      </div>

      {/* Kachel 2: Liquidität */}
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Liquidität</div>
            <div className="text-xs text-slate-400">Kurzfristig verfügbar</div>
          </div>
          <div className="text-sm font-semibold text-slate-100">
            {formatCHF(liquidity)}
          </div>
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Langfristige Anlagen
            </div>
            <div className="text-xs text-slate-400">Gebundenes Vermögen</div>
          </div>
          <div className="text-sm font-semibold text-slate-100">
            {formatCHF(longTerm)}
          </div>
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
