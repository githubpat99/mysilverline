import type { Step5Data, AssetType } from "@/lib/types";

type Props = {
  value: Step5Data;
  onChange: (next: Step5Data) => void;
};

const assets: { value: AssetType; label: string }[] = [
  { value: "etf", label: "ETF" },
  { value: "stocks", label: "Aktien" },
  { value: "funds", label: "Fonds" },
  { value: "bonds", label: "Anleihen" },
  { value: "real_estate", label: "Immobilien" },
  { value: "gold", label: "Gold/Edelmetalle" },
  { value: "crypto", label: "Krypto" },
  { value: "p2p", label: "P2P" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Sonstiges" },
];

function toggle(list: AssetType[], item: AssetType): AssetType[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function Step5Form({ value, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium">Bevorzugte Anlageformen</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={`p-${a.value}`}
              type="button"
              className={`rounded border px-3 py-1 text-sm ${
                value.preferred.includes(a.value) ? "bg-gray-200" : ""
              }`}
              onClick={() => onChange({ ...value, preferred: toggle(value.preferred, a.value) })}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium">Zu vermeiden</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={`a-${a.value}`}
              type="button"
              className={`rounded border px-3 py-1 text-sm ${
                value.avoided.includes(a.value) ? "bg-gray-200" : ""
              }`}
              onClick={() => onChange({ ...value, avoided: toggle(value.avoided, a.value) })}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
