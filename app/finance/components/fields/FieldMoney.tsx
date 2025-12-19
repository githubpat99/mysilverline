"use client";

import { formatCHFInput } from "@/lib/format";

export default function FieldMoney({
  label,
  suffix = "CHF",
  value,
  onChange,
  placeholder = "z.B. 8'500",
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-200">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
        <input
          type="text"
          inputMode="decimal"
          className="flex-1 bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-500"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(formatCHFInput(e.target.value))}
        />
        {suffix && <span className="ml-2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}
