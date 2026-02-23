"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  const calcPos = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const dropH = Math.min(options.length * 44 + 24, 260);
    const openUp = spaceBelow < dropH && r.top > spaceBelow;
    setPos({
      top: openUp ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 160),
      openUp,
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    calcPos();
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => calcPos();
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, calcPos]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const optionsList = (
    <div className="min-h-0 overflow-y-auto overscroll-contain p-3" style={{ maxHeight: isMobile ? undefined : 240 }}>
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
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-400">{label}</label>}
      <button
        ref={triggerRef}
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

      {open &&
        createPortal(
          <div ref={portalRef} data-custom-select-portal>
            <div
              className="fixed inset-0 z-[60] bg-black/70 md:bg-transparent"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            {isMobile ? (
              <div className="fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-2xl border border-slate-800 border-b-0 bg-slate-950 shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-3">
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
                {optionsList}
              </div>
            ) : pos ? (
              <div
                className="fixed z-[61] flex flex-col rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
                style={{
                  left: pos.left,
                  width: pos.width,
                  ...(pos.openUp
                    ? { bottom: window.innerHeight - pos.top }
                    : { top: pos.top }),
                }}
              >
                {optionsList}
              </div>
            ) : null}
          </div>,
          document.body,
        )}
    </div>
  );
}
