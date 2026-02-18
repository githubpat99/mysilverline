import { formatCHF, formatCHFInput, parseCHF } from "@/lib/format";

export default function MoneyInput({
  label,
  value,
  onChange,
  size = "normal", // "short" | "normal"
  suffix = "CHF",
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  size?: "short" | "normal";
  suffix?: string;
  placeholder?: string;
}) {
  const width = size === "short" ? "w-28 sm:w-36" : "w-full min-w-0";

  return (
    <label className="grid gap-2">
      <span className="text-sm text-slate-300">{label}</span>

      <div className={`flex items-center gap-2 ${width}`}>
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-sky-600/40"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={formatCHF(value)}
          onChange={(e) => {
            // live-format -> dann als number (CHF) in State schreiben
            const nextDisplay = formatCHFInput(e.target.value);
            const nextNumber = parseCHF(nextDisplay);
            onChange(nextNumber);
          }}
        />

        {suffix && <span className="text-sm text-slate-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  );
}
