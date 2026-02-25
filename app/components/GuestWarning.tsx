"use client";

import { useEffect, useRef, useState } from "react";

interface GuestWarningProps {
  onLogin: () => void;
}

export default function GuestWarning({ onLogin }: GuestWarningProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-full border border-amber-500/60 bg-amber-950/40 p-1.5 text-amber-400 transition hover:bg-amber-900/50 hover:border-amber-400"
        aria-label="Warnung: Daten nicht gesichert"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-amber-700/60 bg-slate-900 p-4 shadow-xl z-50">
          <div className="flex items-start gap-2.5 mb-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-200">Daten nicht gesichert</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Deine Daten sind nur auf diesem Gerät gespeichert.
                Diese gehen verloren, wenn du den Browser löschst,
                die App deinstallierst oder das Gerät wechselst.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); onLogin(); }}
            className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Jetzt anmelden & sichern
          </button>
        </div>
      )}
    </div>
  );
}
