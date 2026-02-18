"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

type Option = { value: string; label: string };

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Wählen…",
  disabled,
  label,
  className = "",
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-400">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          "w-full flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-left text-slate-100 transition",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-700",
        ].join(" ")}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop – auf Mobile vollflächig für Dark-Mode-Picker */}
          <div
            className="fixed inset-0 z-[60] bg-black/70 md:bg-transparent"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Options Panel – Mobile: Sheet von unten, Desktop: Dropdown */}
          <div
            className={[
              "fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-2xl border border-slate-800 border-b-0 bg-slate-950 shadow-2xl",
              "md:absolute md:inset-auto md:top-full md:left-0 md:right-0 md:mt-1 md:bottom-auto md:rounded-2xl md:rounded-t-2xl md:border-b md:max-h-[16rem]",
            ].join(" ")}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-3 md:hidden">
              <span className="text-sm font-medium text-slate-200">Auswählen</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 -m-2 text-slate-400 hover:text-slate-100"
                aria-label="Schliessen"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-3 md:max-h-[14rem]">
              <div className="flex flex-col gap-0.5">
                {options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={[
                      "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                      value === o.value
                        ? "border-sky-500/60 bg-slate-800 text-sky-200"
                        : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:text-slate-100",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
