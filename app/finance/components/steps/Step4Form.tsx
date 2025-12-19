import type { Step4Data, InvestmentGoal } from "@/lib/types";

type Props = {
  value: Step4Data;
  onChange: (next: Step4Data) => void;
};

const goals: { value: InvestmentGoal; label: string }[] = [
  { value: "security", label: "Sicherheit" },
  { value: "balance", label: "Ausgewogen" },
  { value: "growth", label: "Wachstum" },
];

export default function Step4Form({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Anlageziel</label>
        <select
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 text-slate-100 p-2
             focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={value.goal}
          onChange={(e) =>
            onChange({ ...value, goal: e.target.value as InvestmentGoal })
          }
        >
          <option value="" className="bg-slate-900 text-slate-400">
            Bitte wählen…
          </option>

          {goals.map((g) => (
            <option
              key={g.value}
              value={g.value}
              className="bg-slate-900 text-slate-100"
            >
              {g.label}
            </option>
          ))}
        </select>

      </div>

      <div>
        <label className="block text-sm font-medium">Risikobereitschaft (1–5)</label>
        <input
          className="mt-1 w-full rounded border p-2"
          type="number"
          min={1}
          max={5}
          value={value.risk ?? ""}
          onChange={(e) => onChange({ ...value, risk: e.target.value ? Number(e.target.value) : null })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Anlagehorizont (Jahre)</label>
        <input
          className="mt-1 w-full rounded border p-2"
          type="number"
          min={1}
          max={40}
          value={value.horizonYears ?? ""}
          onChange={(e) => onChange({ ...value, horizonYears: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
    </div>
  );
}
