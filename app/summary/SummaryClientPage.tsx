"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import DonutChart from "@/app/components/DonutChart";
import { loadProfileV2 } from "@/lib/profileApiV2";
import { formatCHF } from "@/lib/format";

type Term = "short" | "long";

type Item = {
  label: string;
  value: number; // CHF
  kind: "asset" | "debt";
  term: Term;
};

function toNumberCHF(v: unknown): number {
  // MoneySchema bei dir: kommt i.d.R. als number ODER string rein – wir machen beides robust
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object") {
    const any = v as any;
    if (typeof any.amount === "number") return any.amount;
    if (typeof any.amount === "string") return toNumberCHF(any.amount);
    if (typeof any.value === "number") return any.value;
    if (typeof any.value === "string") return toNumberCHF(any.value);
  }
  return 0;
}

// ✅ Dein gewünschtes Bilanz-Layout (Kurz/Lang) ergibt sich hier:
function assetTerm(assetType: "cash" | "bank" | "securities" | "other"): Term {
  // In deinem alten Summary war "otherInvest" langfristig.
  // cash/bank/securities = kurzfristig, other = langfristig
  return assetType === "other" ? "long" : "short";
}

function debtTerm(
  debtType:
    | "mortgage"
    | "consumer"
    | "creditcard"
    | "other"
    | "other_short"
    | "loan"
    | "other_long"
): Term {
  // alt: Kurz: creditcard, consumerLoan, otherShort
  //      Lang: mortgage, loan, otherLong
  if (debtType === "mortgage" || debtType === "loan" || debtType === "other_long") return "long";
  if (debtType === "creditcard" || debtType === "consumer" || debtType === "other_short") return "short";
  // "other" ist unklar → ich setze es auf short, damit es eher im Kurzblock auftaucht
  return "short";
}

export default function SummaryPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await loadProfileV2();
        const p = (r as any)?.profile ?? r;     // ✅ unwrap
        const instruments = (p as any)?.instruments ?? [];
        if (!p) {
          setItems(null);
          return;
        }

        const mapped: Item[] = instruments.map((ins: any) => {
          if (ins.kind === "asset") {
            return {
              kind: "asset",
              label: String(ins.label ?? "Unbenannt"),
              value: toNumberCHF(ins.value),
              term: assetTerm(ins.assetType),
            };
          }

          // debt
          return {
            kind: "debt",
            label: String(ins.label ?? "Unbenannt"),
            value: toNumberCHF(ins.balance),
            term: debtTerm(ins.debtType),
          };
        });

        // optional: 0-Werte raus
        setItems(mapped.filter((x) => Math.abs(x.value) > 0.0001));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aktivenKurz = useMemo(() => (items ?? []).filter((x) => x.kind === "asset" && x.term === "short"), [items]);
  const aktivenLang = useMemo(() => (items ?? []).filter((x) => x.kind === "asset" && x.term === "long"), [items]);
  const passivKurz = useMemo(() => (items ?? []).filter((x) => x.kind === "debt" && x.term === "short"), [items]);
  const passivLang = useMemo(() => (items ?? []).filter((x) => x.kind === "debt" && x.term === "long"), [items]);

  const sum = (arr: Item[]) => arr.reduce((acc, x) => acc + (Number.isFinite(x.value) ? x.value : 0), 0);

  const aktivenTotal = useMemo(() => sum(aktivenKurz) + sum(aktivenLang), [aktivenKurz, aktivenLang]);
  const passivenTotal = useMemo(() => sum(passivKurz) + sum(passivLang), [passivKurz, passivLang]);

  if (loading) {
    return <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">Lade Bilanz…</main>;
  }

  if (!items) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-sky-400">Bilanzübersicht</h1>
          <p className="mt-4 text-slate-300">
            Keine DB-Daten gefunden oder nicht eingeloggt. Bitte zuerst im Workflow speichern.
          </p>
          <div className="mt-6">
            <Link href="/finance" className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500">
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
            <p className="text-lg text-green-300 mt-1 mb-6">Total: {formatCHF(aktivenTotal)}</p>

            <Section title="Kurzfristig">
              {aktivenKurz.map((item) => (
                <Row key={`${item.kind}-${item.label}`} label={item.label} value={item.value} color="green" />
              ))}
            </Section>

            <Section title="Langfristig">
              {aktivenLang.map((item) => (
                <Row key={`${item.kind}-${item.label}`} label={item.label} value={item.value} color="green" />
              ))}
            </Section>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-red-400">Passiven</h2>
            <p className="text-lg text-red-300 mt-1 mb-6">Total: {formatCHF(passivenTotal)}</p>

            <Section title="Kurzfristig">
              {passivKurz.map((item) => (
                <Row key={`${item.kind}-${item.label}`} label={item.label} value={item.value} color="red" />
              ))}
            </Section>

            <Section title="Langfristig">
              {passivLang.map((item) => (
                <Row key={`${item.kind}-${item.label}`} label={item.label} value={item.value} color="red" />
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
  value: number;
  color: "green" | "red";
}) {
  return (
    <div className="flex justify-between border-b border-slate-800 pb-2 text-sm">
      <span>{label}</span>
      <span className={color === "green" ? "text-green-300" : "text-red-300"}>{formatCHF(value)}</span>
    </div>
  );
}
