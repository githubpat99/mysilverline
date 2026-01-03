export default function PercentInput(props: {
  label: string;
  value: number;
  onChange: (decimal: number) => void;
  decimals?: number;
}) {
  const { label, value, onChange, decimals = 2 } = props;

  const uiValue = Number.isFinite(value) ? (value * 100).toFixed(decimals) : (0).toFixed(decimals);

  return (
    <label className="grid gap-2">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600/40"
          type="number"
          inputMode="decimal"
          step={String(Math.pow(10, -decimals))}
          value={uiValue}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? n / 100 : 0);
          }}
        />
        <span className="text-sm text-slate-400">%</span>
      </div>
    </label>
  );
}
