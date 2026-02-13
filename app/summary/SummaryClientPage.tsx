// app/summary/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import BalanceSummaryChart from "@/app/components/DonutChart";
import { loadProfileV2 } from "@/lib/profileApiV2";
import { formatCHF } from "@/lib/format";

type Term = "short" | "long";

type Item = {
  label: string;
  value: number; // CHF
  kind: "asset" | "debt";
  term: Term;
};

// Minimal-DTO (robust; wir nehmen nur Felder, die wir wirklich brauchen)
type PositionDTO = {
  id?: string;
  kind: "asset" | "debt";
  label?: string | null;
  bucket?: string | null;

  // assets
  assetType?: string | null;
  valueCHF?: number | string | null;

  // debts
  debtType?: string | null;
  // je nach Version: valueCHF oder balanceCHF / balance
  balanceCHF?: number | string | null;
  balance?: number | string | null;
};

function toNumberCHF(v: unknown): number {
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

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function termFromBucket(bucket: unknown): Term | null {
  const b = norm(bucket);

  // Assets: instant/liq/short => short, long/real => long
  if (
    b === "instant" ||
    b === "liq" ||
    b === "liquidity" ||
    b === "short" ||
    b === "shorta" ||
    b === "st" ||
    b === "lt_3y" ||
    b === "3m_3y"
  ) {
    return "short";
  }
  if (
    b === "long" ||
    b === "longa" ||
    b === "lt" ||
    b === "gt_3y" ||
    b === "real" ||
    b === "reala" ||
    b === "real_estate" ||
    b === "realestate"
  ) {
    return "long";
  }

  // Debts (falls ihr bucket so heisst)
  if (b === "shortd") return "short";
  if (b === "longd") return "long";

  return null;
}

function assetTerm(assetType: unknown, bucket: unknown): Term {
  // zuerst bucket (wenn vorhanden, ist das bei dir die sauberste Quelle)
  const tb = termFromBucket(bucket);
  if (tb) return tb;

  // Fallback: alte Logik (cash/bank/securities = short, other = long)
  const t = norm(assetType);
  if (t === "other" || t === "otherinvest" || t === "investment" || t === "real_estate") return "long";
  return "short";
}

function debtTerm(debtType: unknown, bucket: unknown): Term {
  const tb = termFromBucket(bucket);
  if (tb) return tb;

  const t = norm(debtType);
  // alt: Lang: mortgage, loan, other_long
  if (t === "mortgage" || t === "loan" || t === "other_long") return "long";
  // Kurz: creditcard, consumer, other_short
  if (t === "creditcard" || t === "consumer" || t === "other_short") return "short";

  return "short";
}

function getNonce(): string | null {
  // je nachdem wie du es speicherst – wir versuchen mehrere Keys
  const keys = ["sl_nonce", "silverline_nonce", "nonce"];
  for (const k of keys) {
    const v = typeof window !== "undefined" ? window.sessionStorage.getItem(k) : null;
    if (v && v.length > 10) return v;
  }
  return null;
}

async function loadPositionsV2(): Promise<PositionDTO[]> {
  const nonce = getNonce();

  // probiere beide URL-Varianten (je nach Deployment / Rewrites)
  const urls = ["/api/silverline/v1/positions", "/wp-json/silverline/v1/positions"];

  let lastErr: unknown = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          ...(nonce ? { "X-SL-Nonce": nonce } : {}),
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);

      const data = await res.json();

      // unwrap: { positions: [...] } oder { data: { positions: [...] } } oder direkt [...]
      const positions =
        (data && (data.positions as any)) ??
        (data && (data.data?.positions as any)) ??
        (data && (data.profile?.positions as any)) ??
        data;

      if (Array.isArray(positions)) return positions as PositionDTO[];

      // manchmal: { ok: true, positions: [...] }
      if (positions && Array.isArray((positions as any).positions)) return (positions as any).positions;

      return [];
    } catch (e) {
      lastErr = e;
    }
  }

  // wenn gar nichts ging: Fehler weiterwerfen, damit UI "nicht eingeloggt / keine Daten" zeigt
  throw lastErr ?? new Error("positions load failed");
}

export default function SummaryPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // wichtig: triggert bei dir i.d.R. Nonce/Session-Setup (und Login-Check)
        // wir brauchen das Ergebnis hier nicht zwingend, aber es stabilisiert Auth.
        try {
          await loadProfileV2();
        } catch {
          // egal – positions kann trotzdem gehen (Cookie-Fallback)
        }

        const positions = await loadPositionsV2();

        if (!positions) {
          setItems(null);
          return;
        }

        const mapped: Item[] = positions.map((p) => {
          const label = String(p.label ?? "Unbenannt");

          if (p.kind === "asset") {
            return {
              kind: "asset",
              label,
              value: toNumberCHF(p.valueCHF),
              term: assetTerm(p.assetType, p.bucket),
            };
          }

          // debt: je nach API-Version valueCHF oder balanceCHF/balance
          const debtValue =
            p.balanceCHF ?? p.balance ?? (p as any).valueCHF ?? (p as any).principalCHF ?? (p as any).principal;

          return {
            kind: "debt",
            label,
            value: toNumberCHF(debtValue),
            term: debtTerm(p.debtType, p.bucket),
          };
        });

        setItems(mapped.filter((x) => Math.abs(x.value) > 0.0001));
      } catch {
        setItems(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aktivenKurz = useMemo(
    () => (items ?? []).filter((x) => x.kind === "asset" && x.term === "short"),
    [items]
  );
  const aktivenLang = useMemo(
    () => (items ?? []).filter((x) => x.kind === "asset" && x.term === "long"),
    [items]
  );
  const passivKurz = useMemo(
    () => (items ?? []).filter((x) => x.kind === "debt" && x.term === "short"),
    [items]
  );
  const passivLang = useMemo(
    () => (items ?? []).filter((x) => x.kind === "debt" && x.term === "long"),
    [items]
  );

  const sum = (arr: Item[]) => arr.reduce((acc, x) => acc + (Number.isFinite(x.value) ? x.value : 0), 0);

  const aktivenTotal = useMemo(() => sum(aktivenKurz) + sum(aktivenLang), [aktivenKurz, aktivenLang]);
  const passivenTotal = useMemo(() => sum(passivKurz) + sum(passivLang), [passivKurz, passivLang]);

  if (loading) {
    return <main className="bg-slate-950 text-slate-50 px-6 py-10">Lade Bilanz…</main>;
  }

  if (!items) {
    return (
      <main className="bg-slate-950 text-slate-50 px-6 py-10">
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
    <main className="bg-slate-950 text-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-sky-400 mb-10">Bilanzübersicht</h1>

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-green-400">Aktiven</h2>
            <p className="text-lg text-green-300 mt-1 mb-6">Total: {formatCHF(aktivenTotal)}</p>

            <Section title="Kurzfristig">
              {aktivenKurz.map((item, idx) => (
                <Row key={`${item.kind}-${item.label}-${idx}`} label={item.label} value={item.value} color="green" />
              ))}
            </Section>

            <Section title="Langfristig">
              {aktivenLang.map((item, idx) => (
                <Row key={`${item.kind}-${item.label}-${idx}`} label={item.label} value={item.value} color="green" />
              ))}
            </Section>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-red-400">Passiven</h2>
            <p className="text-lg text-red-300 mt-1 mb-6">Total: {formatCHF(passivenTotal)}</p>

            <Section title="Kurzfristig">
              {passivKurz.map((item, idx) => (
                <Row key={`${item.kind}-${item.label}-${idx}`} label={item.label} value={item.value} color="red" />
              ))}
            </Section>

            <Section title="Langfristig">
              {passivLang.map((item, idx) => (
                <Row key={`${item.kind}-${item.label}-${idx}`} label={item.label} value={item.value} color="red" />
              ))}
            </Section>
          </div>
        </div>

        <div className="mt-12">
          <BalanceSummaryChart
            totalAssets={aktivenTotal}
            totalLiabilities={passivenTotal}
          />
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
