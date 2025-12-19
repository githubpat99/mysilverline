import type { Step6Data } from "@/lib/types";

type Props = {
  value: Step6Data;
  onChange: (next: Step6Data) => void;
};

export default function Step6Form({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Mindestliquidität (CHF)</label>
        <input
          className="mt-1 w-full rounded border p-2"
          value={value.minLiquidity}
          onChange={(e) => onChange({ ...value, minLiquidity: e.target.value })}
          inputMode="decimal"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Monatliche Sparrate (CHF)</label>
        <input
          className="mt-1 w-full rounded border p-2"
          value={value.monthlySaving}
          onChange={(e) => onChange({ ...value, monthlySaving: e.target.value })}
          inputMode="decimal"
        />
      </div>
    </div>
  );
}
