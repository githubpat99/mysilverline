"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import CustomSelect from "./CustomSelect";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseYMD(s: string | null | undefined): { y: number; m: number; d: number } {
  if (!s || s.length !== 10) {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }
  const [y, m, d] = s.split("-").map(Number);
  return { y: y || new Date().getFullYear(), m: m || 1, d: d || 1 };
}

function toYMD(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(Math.min(d, daysInMonth(y, m))).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function formatDisplay(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const { y, m, d } = parseYMD(ymd);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

export default function CustomDateInput({
  value,
  onChange,
  label,
  placeholder = "Datum wählen…",
  allowEmpty = false,
  minYear = 2020,
  maxYear = 2040,
  className = "",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  minYear?: number;
  maxYear?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = parseYMD(value ?? "");
  const [y, setY] = useState(parsed.y);
  const [m, setM] = useState(parsed.m);
  const [d, setD] = useState(parsed.d);

  useEffect(() => {
    const p = parseYMD(value ?? "");
    setY(p.y);
    setM(p.m);
    setD(p.d);
  }, [value, open]);

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

  const maxD = daysInMonth(y, m);
  const dayOpts = Array.from({ length: maxD }, (_, i) => i + 1);
  const yearOpts = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  function apply() {
    const clamped = Math.min(d, maxD);
    onChange(toYMD(y, m, clamped));
    setOpen(false);
  }

  function clear() {
    if (allowEmpty) {
      onChange(null);
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-400">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-left text-slate-100 transition hover:border-slate-700"
      >
        <span className={value ? "" : "text-slate-500"}>{value ? formatDisplay(value) : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 md:bg-transparent" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={[
              "fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-2xl border border-slate-800 border-b-0 bg-slate-950 shadow-2xl",
              "md:absolute md:inset-auto md:top-full md:left-0 md:right-0 md:mt-1 md:bottom-auto md:rounded-2xl md:rounded-t-2xl md:border-b",
            ].join(" ")}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-3">
              <span className="text-sm font-medium text-slate-200">Datum</span>
              <div className="flex items-center gap-2">
                {allowEmpty && (
                  <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    Leeren
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="p-2 -m-2 text-slate-400 hover:text-slate-100" aria-label="Schliessen">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <CustomSelect
                  label="Tag"
                  options={dayOpts.map((n) => ({ value: String(n), label: String(n) }))}
                  value={String(d)}
                  onChange={(v) => setD(Number(v))}
                  placeholder="Tag"
                />
                <CustomSelect
                  label="Monat"
                  options={MONTHS.map((month, i) => ({ value: String(i + 1), label: month }))}
                  value={String(m)}
                  onChange={(v) => {
                    const next = Number(v);
                    setM(next);
                    setD((prev) => Math.min(prev, daysInMonth(y, next)));
                  }}
                  placeholder="Monat"
                />
                <CustomSelect
                  label="Jahr"
                  options={yearOpts.map((n) => ({ value: String(n), label: String(n) }))}
                  value={String(y)}
                  onChange={(v) => {
                    const next = Number(v);
                    setY(next);
                    setD((prev) => Math.min(prev, daysInMonth(next, m)));
                  }}
                  placeholder="Jahr"
                />
              </div>
              <button
                type="button"
                onClick={apply}
                className="w-full rounded-xl border border-sky-600 bg-sky-600/20 py-2.5 text-sm font-medium text-sky-200 hover:bg-sky-600/30"
              >
                Fertig
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
