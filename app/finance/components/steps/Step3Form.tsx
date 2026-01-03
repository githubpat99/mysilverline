"use client";

import type { Step3Data } from "@/lib/types";
import MoneyInput from "@/app/lotto/components/MoneyInput";

type Props = {
  value: Step3Data;
  onChange: (next: Step3Data) => void;
};

const INDEXATION_OPTIONS: Array<{ value: Step3Data["indexation"]; label: string }> = [
  { value: "inflation", label: "mit Inflation" },
  { value: "fixed_real", label: "real konstant" },
  { value: "fixed_nominal", label: "nominal fix" },
];

export default function Step3Form({ value, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="text-sm font-semibold text-slate-100">Jährliche Basis</div>
        <div className="mt-1 text-xs text-slate-500">
          Diese Werte werden im Finance-Forecast als Grundmodell verwendet.
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Jahreseinnahmen heute (gesamt)"
            value={Number(String(value.annualIncomeToday || "0").replace(/[’'\s]/g, "").replace(",", ".")) || 0}
            onChange={(n: number) =>
              onChange({ ...value, annualIncomeToday: String(Math.trunc(n)) })
            }
            suffix="CHF"
            size="short"
          />

          <MoneyInput
            label="Jahresausgaben heute (gesamt)"
            value={Number(String(value.annualSpendingToday || "0").replace(/[’'\s]/g, "").replace(",", ".")) || 0}
            onChange={(n: number) =>
              onChange({ ...value, annualSpendingToday: String(Math.trunc(n)) })
            }
            suffix="CHF"
            size="short"
          />
        </div>

        <div className="mt-4">
          <label className="block text-xs text-slate-400 mb-1">Indexierung</label>
          <select
            value={value.indexation ?? "inflation"}
            onChange={(e) =>
              onChange({ ...value, indexation: e.target.value as Step3Data["indexation"] })
            }
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

      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="text-sm font-semibold text-slate-100">Zukünftige Ein-/Ausgaben</div>
        <div className="mt-1 text-xs text-slate-500">
          V1: wird als einmalig (im ersten Jahr) interpretiert.
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Zukünftige Einnahmen (einmalig)"
            value={Number(String(value.futureIncome || "0").replace(/[’'\s]/g, "").replace(",", ".")) || 0}
            onChange={(n: number) => onChange({ ...value, futureIncome: String(Math.trunc(n)) })}
            suffix="CHF"
            size="short"
          />

          <MoneyInput
            label="Zukünftige Ausgaben (einmalig)"
            value={Number(String(value.futureExpense || "0").replace(/[’'\s]/g, "").replace(",", ".")) || 0}
            onChange={(n: number) => onChange({ ...value, futureExpense: String(Math.trunc(n)) })}
            suffix="CHF"
            size="short"
          />
        </div>

        <div className="mt-4">
          <label className="block text-xs text-slate-400 mb-1">Notizen (optional)</label>
          <textarea
            value={value.notes ?? ""}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            rows={3}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-100"
            placeholder="z.B. Autokauf 2027, Renovation, Erbschaft, Bonus, ..."
          />
        </div>
      </div>
    </div>
  );
}
