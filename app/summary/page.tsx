"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import DonutChart from "@/app/components/DonutChart";
import { loadProfile } from "@/lib/profileApi";
import type { FormState } from "@/lib/types";
import { parseCHF, formatCHF } from "@/lib/format";

export default function SummaryPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const dbForm = await loadProfile();
        setForm(dbForm);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aktivenKurz = useMemo(() => {
    if (!form) return [];
    return [
      { label: "Bargeld", value: form.step1.cash },
      { label: "Bankkonto (Sparen)", value: form.step1.bankSavings },
      { label: "Wertschriften", value: form.step1.securities },
    ];
  }, [form]);

  const aktivenLang = useMemo(() => {
    if (!form) return [];
    return [{ label: "Weitere Investitionen", value: form.step1.otherInvest }];
  }, [form]);

  const passivKurz = useMemo(() => {
    if (!form) return [];
    return [
      { label: "Kreditkarte", value: form.step2.creditCard },
      { label: "Konsumkredit", value: form.step2.consumerLoan },
      { label: "Weitere kurzfristige", value: form.step2.otherShort },
    ];
  }, [form]);

  const passivLang = useMemo(() => {
    if (!form) return [];
    return [
      { label: "Hypotheken", value: form.step2.mortgage },
      { label: "Darlehen", value: form.step2.loan },
      { label: "Weitere langfristige", value: form.step2.otherLong },
    ];
  }, [form]);

  const sum = (items: { value: string }[]) =>
    items.reduce((acc, x) => acc + parseCHF(x.value), 0);

  const aktivenTotal = useMemo(
    () => sum(aktivenKurz) + sum(aktivenLang),
    [aktivenKurz, aktivenLang]
  );

  const passivenTotal = useMemo(
    () => sum(passivKurz) + sum(passivLang),
    [passivKurz, passivLang]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        Lade Bilanz…
      </main>
    );
  }

  if (!form) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-sky-400">Bilanzübersicht</h1>
          <p className="mt-4 text-slate-300">
            Keine DB-Daten gefunden oder nicht eingeloggt. Bitte zuerst im Workflow speichern.
          </p>
          <div className="mt-6">
            <Link
              href="/finance"
              className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500"
            >
              Zum Finanz-Workflow
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-sky-400 mb-10">Bilanzübersicht</h1>

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-green-400">Aktiven</h2>
            <p className="text-lg text-green-300 mt-1 mb-6">
              Total: {formatCHF(aktivenTotal)}
            </p>

            <Section title="Kurzfristig">
              {aktivenKurz.map((item) => (
                <Row key={item.label} label={item.label} value={item.value} color="green" />
              ))}
            </Section>

            <Section title="Langfristig">
              {aktivenLang.map((item) => (
                <Row key={item.label} label={item.label} value={item.value} color="green" />
              ))}
            </Section>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-red-400">Passiven</h2>
            <p className="text-lg text-red-300 mt-1 mb-6">
              Total: {formatCHF(passivenTotal)}
            </p>

            <Section title="Kurzfristig">
              {passivKurz.map((item) => (
                <Row key={item.label} label={item.label} value={item.value} color="red" />
              ))}
            </Section>

            <Section title="Langfristig">
              {passivLang.map((item) => (
                <Row key={item.label} label={item.label} value={item.value} color="red" />
              ))}
            </Section>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <DonutChart aktiven={aktivenTotal} passiven={passivenTotal} />
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "red";
}) {
  const n = parseCHF(value);

  return (
    <div className="flex justify-between border-b border-slate-800 pb-2 text-sm">
      <span>{label}</span>
      <span className={color === "green" ? "text-green-300" : "text-red-300"}>
        {formatCHF(n)}
      </span>
    </div>
  );
}
