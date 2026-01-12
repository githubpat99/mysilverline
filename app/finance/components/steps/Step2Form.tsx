"use client";

import type { FormState } from "@/lib/types";
import FieldMoney from "../fields/FieldMoney";

type Step2Data = FormState["step2"];

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

export default function Step2Form({
  value,
  onChange,
}: {
  value: Step2Data;
  onChange: (field: keyof Step2Data, value: string) => void;
}) {
  const shortTerm =
    parseMoney(value.creditCard) +
    parseMoney(value.consumerLoan) +
    parseMoney(value.otherShort);

  const longTerm =
    parseMoney(value.mortgage) +
    parseMoney(value.loan) +
    parseMoney(value.otherLong);

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-50">
        Schritt 2: Schulden & Verpflichtungen
      </h2>

      <p className="mt-2 text-sm text-slate-300">
        Kurzfristige Verpflichtungen beeinflussen die Liquidität, langfristige
        Schulden primär den Cashflow.
      </p>

      {/* KFR */}
      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Kurzfristige Verpflichtungen
            </div>
            <div className="text-xs text-slate-400">≤ 12 Monate</div>
          </div>
          <div className="text-sm font-semibold text-slate-100">
            {formatCHF(shortTerm)}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldMoney
            label="Kreditkarte"
            value={value.creditCard}
            onChange={(v) => onChange("creditCard", v)}
          />
          <FieldMoney
            label="Konsumkredit"
            value={value.consumerLoan}
            onChange={(v) => onChange("consumerLoan", v)}
          />
          <FieldMoney
            label="Weitere kurzfristige"
            value={value.otherShort}
            onChange={(v) => onChange("otherShort", v)}
          />
        </div>
      </div>

      {/* LFR */}
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Langfristige Schulden
            </div>
            <div className="text-xs text-slate-400">
              Wirken über Zinsen & Amortisation
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-100">
            {formatCHF(longTerm)}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldMoney
            label="Hypotheken"
            value={value.mortgage}
            onChange={(v) => onChange("mortgage", v)}
          />
          <FieldMoney
            label="Darlehen"
            value={value.loan}
            onChange={(v) => onChange("loan", v)}
          />
          <FieldMoney
            label="Weitere langfristige"
            value={value.otherLong}
            onChange={(v) => onChange("otherLong", v)}
          />
        </div>
      </div>
    </div>
  );
}
