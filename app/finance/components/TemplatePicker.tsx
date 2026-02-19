"use client";

import React, { useEffect, useState } from "react";
import { getLifeTemplates, type LifeTemplate } from "@/lib/templates/lifeTemplates";
import { loadMusterfall } from "@/lib/musterfallApi";
import { mapV2ToFormState } from "@/lib/mapping/mapV2ToFormState";
import type { FormState } from "@/lib/types";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";

type Props = {
  onSelect: (form: FormState) => void;
  onSkip?: () => void;
  title?: string;
  subtitle?: string;
  /** Pre-loaded Musterfall FormState (avoids double fetch on /musterfall page) */
  musterfallForm?: FormState | null;
};

function fmt(n: number): string {
  return n.toLocaleString("de-CH");
}

const templateIcons: Record<string, React.ReactNode> = {
  "single-jung": (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className="h-10 w-10">
      <circle cx="20" cy="12" r="6" stroke="#38bdf8" strokeWidth="2" />
      <path d="M10 34c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 8l3-4M27 12h4" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  "single-45": (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className="h-10 w-10">
      <rect x="6" y="8" width="28" height="20" rx="2" stroke="#38bdf8" strokeWidth="2" />
      <path d="M6 14h28" stroke="#38bdf8" strokeWidth="2" />
      <circle cx="20" cy="22" r="3" stroke="#38bdf8" strokeWidth="1.5" />
      <path d="M14 32h12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  "familie-30": (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className="h-10 w-10">
      <circle cx="14" cy="10" r="5" stroke="#38bdf8" strokeWidth="2" />
      <circle cx="28" cy="10" r="4" stroke="#38bdf8" strokeWidth="1.5" />
      <circle cx="34" cy="18" r="3" stroke="#38bdf8" strokeWidth="1.5" />
      <path d="M4 32c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  "familie-50": (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className="h-10 w-10">
      <path d="M20 6l14 12H6L20 6z" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="18" width="20" height="14" stroke="#38bdf8" strokeWidth="2" />
      <rect x="17" y="22" width="6" height="10" stroke="#38bdf8" strokeWidth="1.5" />
      <path d="M4 32h32" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  "pensionaer": (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className="h-10 w-10">
      <circle cx="20" cy="20" r="14" stroke="#38bdf8" strokeWidth="2" />
      <path d="M10 26c2-6 6-10 10-10s8 4 10 10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 20l-2-4M28 20l2-4M16 12l-1-4M24 12l1-4M20 10V6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  musterfall: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className="h-10 w-10">
      <rect x="8" y="4" width="24" height="32" rx="2" stroke="#38bdf8" strokeWidth="2" />
      <path d="M14 12h12M14 18h12M14 24h8" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 26l4 4" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="28" r="4" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  ),
};

function TemplateCard({ tpl, onSelect }: { tpl: LifeTemplate; onSelect: () => void }) {
  const { formState: f } = tpl;
  const totalAssets = f.step1.positions.reduce((s, p) => s + p.amountChf, 0);
  const totalDebts = f.step2.positions.reduce((s, p) => s + p.balanceChf, 0);
  const totalIncome = f.step3.annualsV2.income.reduce((s, i) => s + i.amountCHF, 0);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 text-left transition hover:border-sky-500/50 hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-sky-500"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {templateIcons[tpl.id] ?? <span className="text-3xl">{tpl.icon}</span>}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-100 group-hover:text-sky-200 transition">
            {tpl.label}
          </h3>
          <p className="mt-1 text-sm text-slate-400 leading-snug">{tpl.description}</p>
        </div>
      </div>

      <div className="mt-auto grid w-full grid-cols-3 gap-2 pt-2 border-t border-slate-800/60">
        <div>
          <div className="text-[10px] text-slate-500 leading-tight">Vermögen</div>
          <div className="text-sm font-medium text-emerald-400">{fmt(totalAssets)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 leading-tight">Schulden</div>
          <div className="text-sm font-medium text-rose-400">{totalDebts > 0 ? fmt(totalDebts) : "–"}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 leading-tight">Einkommen</div>
          <div className="text-sm font-medium text-sky-300">{fmt(totalIncome)}</div>
        </div>
      </div>
    </button>
  );
}

function buildMusterfallTemplate(form: FormState): LifeTemplate {
  return {
    id: "musterfall",
    label: "Musterfall",
    description: form.base.description?.trim() || "Realistisches Beispiel-Szenario aus der Praxis.",
    icon: "📋",
    formState: form,
  };
}

export default function TemplatePicker({
  onSelect,
  onSkip,
  title = "Willkommen bei Silverline",
  subtitle = "Wählen Sie ein Szenario als Startpunkt – Sie können alle Werte danach anpassen.",
  musterfallForm,
}: Props) {
  const [loadedMusterfall, setLoadedMusterfall] = useState<FormState | null>(null);

  useEffect(() => {
    if (musterfallForm !== undefined) return;
    loadMusterfall()
      .then((res) => {
        const form = mapV2ToFormState(res.profile as ProfileV2, res.positions as PositionDTO[]);
        setLoadedMusterfall(form);
      })
      .catch(() => {});
  }, [musterfallForm]);

  const mf = musterfallForm ?? loadedMusterfall;
  const templates: LifeTemplate[] = [
    ...getLifeTemplates(),
    ...(mf ? [buildMusterfallTemplate(mf)] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        <p className="mt-2 text-slate-400">{subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            tpl={tpl}
            onSelect={() => onSelect(tpl.formState)}
          />
        ))}
      </div>

      {onSkip && (
        <div className="mt-8 flex items-center justify-center text-sm">
          <button
            type="button"
            onClick={onSkip}
            className="text-slate-400 underline underline-offset-4 hover:text-slate-200 transition"
          >
            Oder starte mit leeren Daten
          </button>
        </div>
      )}
    </div>
  );
}
