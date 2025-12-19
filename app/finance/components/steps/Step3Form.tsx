import type { Step3Data } from "@/lib/types";

type Props = {
  value: Step3Data;
  onChange: (next: Step3Data) => void;
};

export default function Step3Form({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Zukünftige Einnahmen (CHF)</label>
        <input
          className="mt-1 w-full rounded border p-2"
          value={value.futureIncome}
          onChange={(e) => onChange({ ...value, futureIncome: e.target.value })}
          inputMode="decimal"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Zukünftige Ausgaben (CHF)</label>
        <input
          className="mt-1 w-full rounded border p-2"
          value={value.futureExpense}
          onChange={(e) => onChange({ ...value, futureExpense: e.target.value })}
          inputMode="decimal"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Notizen (optional)</label>
        <textarea
          className="mt-1 w-full rounded border p-2"
          value={value.notes ?? ""}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
