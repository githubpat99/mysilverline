import type { Step6Data } from "@/lib/types";
import FieldMoney from "@/app/finance/components/fields/FieldMoney"; // Pfad ggf. anpassen

type Props = {
  value: Step6Data;
  onChange: (next: Step6Data) => void;
};

export default function Step6Form({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <FieldMoney
        label="Mindestliquidität (CHF)"
        value={value.minLiquidity}
        onChange={(v) => onChange({ ...value, minLiquidity: v })}
      />

      <FieldMoney
        label="Monatliche Sparrate (CHF)"
        value={value.monthlySaving}
        onChange={(v) => onChange({ ...value, monthlySaving: v })}
      />
    </div>
  );
}
