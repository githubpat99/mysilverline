"use client";

import { useEffect, useState } from "react";
import { canonicalCHF, formatCHFInput } from "@/lib/format";

export default function FieldMoney({
  label,
  suffix = "CHF",
  value,
  onChange,
  placeholder = "z.B. 8'500",
}: {
  label: string;
  suffix?: string;
  value: string;                 // <-- kanonisch im Parent: "3500"
  onChange: (value: string) => void; // <-- bekommt kanonisch
  placeholder?: string;
}) {
  const [display, setDisplay] = useState<string>("");

  // Wenn value von aussen kommt (DB load), immer hübsch anzeigen
  useEffect(() => {
    setDisplay(value ? formatCHFInput(value) : "");
  }, [value]);

  return (
    <label className="block text-sm">
      <span className="text-slate-200">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
        <input
          type="text"
          inputMode="numeric"
          className="flex-1 bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-500"
          placeholder={placeholder}
          value={display}
          onChange={(e) => {
            const raw = e.target.value;
            setDisplay(raw);
            onChange(canonicalCHF(raw)); // <-- Parent bleibt kanonisch
          }}
          onBlur={() => {
            const canon = canonicalCHF(display);
            onChange(canon);
            setDisplay(canon ? formatCHFInput(canon) : "");
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.currentTarget.focus();
          }}
          onMouseUp={(e) => {
            const el = e.currentTarget;
            el.setSelectionRange(0, el.value.length);
          }}
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.setSelectionRange(0, el.value.length));
          }}
        />
        {suffix && <span className="ml-2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}
