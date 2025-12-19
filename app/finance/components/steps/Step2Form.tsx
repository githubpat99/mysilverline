"use client";

import type { FormState } from "@/lib/types";
import FieldMoney from "@/app/finance/components/fields/FieldMoney";

type Step2Data = FormState["step2"];

export default function Step2Form({
  value,
  onChange,
}: {
  value: Step2Data;
  onChange: (field: keyof Step2Data, value: string) => void;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-50">
        Schritt 2: Schulden & Hypotheken
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        Erfasse hier deine kurzfristigen und langfristigen Verbindlichkeiten.
      </p>

      <h3 className="mt-6 text-sm font-semibold text-red-400">Kurzfristig</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
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

      <h3 className="mt-6 text-sm font-semibold text-red-400">Langfristig</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
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
  );
}
