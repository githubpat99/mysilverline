// ===================================
// file: ForecastChartSummary.tsx
// ===================================
"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { AlertTriangle, X, Clock, CalendarClock, TrendingDown, Wallet, ArrowDownCircle, PiggyBank, ShieldCheck, BarChart3, RefreshCw } from "lucide-react";

export type Buckets = {
  liq: number;
  shortA: number;
  longA: number;
  realA: number;
  shortD?: number;
  longD?: number;
};

export type YearRow = {
  year: number;
  liq: number;
  shortA: number;
  longA: number;
  realA: number;
  shortD?: number;
  longD?: number;
  start?: Buckets;

  netFlow?: number;
  assetCF?: number;
  events?: number;

  assetCashflowToLiq?: number;
  assetCashflowReinvest?: number;
  debtInterest?: number;
  debtAmort?: number;
};

function n(x: any): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}
function sum(...xs: number[]) {
  return xs.reduce((a, b) => a + n(b), 0);
}

function endBucketsOf(r: YearRow): Buckets {
  return {
    liq: n(r.liq),
    shortA: n(r.shortA),
    longA: n(r.longA),
    realA: n(r.realA),
    shortD: r.shortD == null ? undefined : n(r.shortD),
    longD: r.longD == null ? undefined : n(r.longD),
  };
}

function netWorth(b: Buckets) {
  const assets = sum(b.liq, b.shortA, b.longA, b.realA);
  const debts = sum(b.shortD ?? 0, b.longD ?? 0);
  return { assets, debts, net: assets - debts };
}

function formatCHF(v: number) {
  return Math.trunc(n(v)).toLocaleString("de-CH");
}

function ChartTooltipContent({ active, label, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const liqCritical = p.liq <= 0;
  return (
    <div
      style={{
        background: "rgba(2,6,23,0.95)",
        border: `1px solid ${liqCritical ? "rgba(245,158,11,0.5)" : "rgba(148,163,184,0.2)"}`,
        padding: "10px 14px",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        minWidth: 140,
      }}
    >
      <div style={{ color: "rgba(148,163,184,0.9)", fontSize: 12 }}>Jahr {label}</div>
      <div
        style={{
          color: p.net >= (p.prevNet ?? p.net) ? "#10b981" : "#f43f5e",
          fontSize: 15,
          fontWeight: 600,
          marginTop: 4,
        }}
      >
        {formatCHF(p.net)} CHF
      </div>
      <div
        style={{
          color: liqCritical ? "#f59e0b" : "#94a3b8",
          fontSize: 12,
          marginTop: 4,
          fontWeight: liqCritical ? 600 : 400,
        }}
      >
        {liqCritical && "⚠ "}Liquidität: {formatCHF(p.liq)} CHF
      </div>
    </div>
  );
}

function buildStrokeGradient(data: { year: number; net: number }[]) {
  if (data.length < 2) return [];
  const total = data.length - 1;
  const stops: { offset: string; color: string }[] = [];
  for (let i = 0; i < total; i++) {
    const pctStart = (i / total) * 100;
    const pctEnd = ((i + 1) / total) * 100;
    const color = data[i + 1].net >= data[i].net ? "#10b981" : "#f43f5e";
    stops.push({ offset: `${pctStart.toFixed(1)}%`, color });
    stops.push({ offset: `${pctEnd.toFixed(1)}%`, color });
  }
  return stops;
}

function buildLiqStrokeGradient(data: { year: number; liq: number }[]) {
  if (data.length < 2) return [];
  const total = data.length - 1;
  const stops: { offset: string; color: string }[] = [];
  for (let i = 0; i < total; i++) {
    const pctStart = (i / total) * 100;
    const pctEnd = ((i + 1) / total) * 100;
    const color = data[i + 1].liq >= data[i].liq ? "#6ee7b7" : "#fda4af";
    stops.push({ offset: `${pctStart.toFixed(1)}%`, color });
    stops.push({ offset: `${pctEnd.toFixed(1)}%`, color });
  }
  return stops;
}

const PERIOD_OPTIONS = [
  { key: "3J", label: "3 Jahre", n: 3 },
  { key: "5J", label: "5 Jahre", n: 5 },
  { key: "10J", label: "10 Jahre", n: 10 },
  { key: "Gesamt", label: "Gesamt", n: 0 },
] as const;

type Urgency = "acute" | "medium" | "long";

function getUrgency(yearsUntil: number): Urgency {
  if (yearsUntil <= 1) return "acute";
  if (yearsUntil <= 3) return "medium";
  return "long";
}

const URGENCY_META: Record<Urgency, {
  label: string; barLabel: string; color: string; border: string; bg: string;
  barBorder: string; barBg: string; barText: string; barIcon: string; barHoverBorder: string; barHoverBg: string; barDetail: string;
  icon: typeof Clock;
}> = {
  acute: {
    label: "Sofort handeln", barLabel: "Liquiditäts-Warnung", color: "text-rose-400", border: "border-rose-500/40", bg: "bg-rose-950/40",
    barBorder: "border-rose-500/40", barBg: "bg-rose-950/30", barText: "text-rose-200", barIcon: "text-rose-400",
    barHoverBorder: "hover:border-rose-500/60", barHoverBg: "hover:bg-rose-950/50", barDetail: "text-rose-500/70",
    icon: Clock,
  },
  medium: {
    label: "Jetzt planen", barLabel: "Liquiditäts-Warnung", color: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-950/30",
    barBorder: "border-amber-500/30", barBg: "bg-amber-950/30", barText: "text-amber-200", barIcon: "text-amber-400",
    barHoverBorder: "hover:border-amber-500/50", barHoverBg: "hover:bg-amber-950/50", barDetail: "text-amber-500/70",
    icon: CalendarClock,
  },
  long: {
    label: "Strategie entwickeln", barLabel: "Liquiditäts-Hinweis", color: "text-slate-300", border: "border-slate-600/30", bg: "bg-slate-800/20",
    barBorder: "border-slate-600/20", barBg: "bg-slate-800/15", barText: "text-slate-300", barIcon: "text-slate-400",
    barHoverBorder: "hover:border-slate-500/30", barHoverBg: "hover:bg-slate-800/30", barDetail: "text-slate-500",
    icon: BarChart3,
  },
};

type Tip = { icon: typeof Wallet; title: string; text: string };

const TIPS: Record<Urgency, Tip[]> = {
  acute: [
    { icon: ArrowDownCircle, title: "Ausgaben sofort reduzieren", text: "Unnötige Abos kündigen, variable Kosten kürzen. Fokus auf das Nötigste." },
    { icon: Wallet, title: "Liquiditätsreserve sichern", text: "3–6 Monatsausgaben als Puffer verfügbar halten. Gebundenes Vermögen prüfen." },
    { icon: TrendingDown, title: "Konsumschulden prioritär tilgen", text: "Kreditkarten und Konsumkredite kosten am meisten Zinsen – zuerst abbauen." },
    { icon: PiggyBank, title: "Zusätzliche Einnahmen prüfen", text: "Nebenerwerbsmöglichkeiten, Verkauf nicht genutzter Sachwerte oder Umschichtungen." },
  ],
  medium: [
    { icon: BarChart3, title: "Einnahmen/Ausgaben-Verhältnis optimieren", text: "Systematisch analysieren, wo die grössten Hebel liegen – Fixkosten, Versicherungen, Wohnkosten." },
    { icon: CalendarClock, title: "Verpflichtungen neu planen", text: "Amortisationen, Leasingraten und fixe Verträge zeitlich entzerren oder reduzieren." },
    { icon: Wallet, title: "Anlagestrategie überprüfen", text: "Ist zu viel Vermögen gebunden? Umschichtung von langfristig zu kurzfristig verfügbar prüfen." },
    { icon: ShieldCheck, title: "Vermögensverzehr-Strategie definieren", text: "Festlegen, aus welchen Töpfen wann entnommen wird – geplant statt gezwungen." },
  ],
  long: [
    { icon: BarChart3, title: "Ausgaben- und Einnahmenstruktur prüfen", text: "Gibt es einen strukturellen Überhang? Fixkosten, Abos und wiederkehrende Ausgaben langfristig hinterfragen." },
    { icon: PiggyBank, title: "Sparquote und Rücklagen stärken", text: "Regelmässig Reserven aufbauen – auch kleine Beträge wirken über Jahre. Ziel: 3–6 Monatsausgaben als Puffer." },
    { icon: CalendarClock, title: "Grosse Ausgaben vorausplanen", text: "Auto, Renovation, Ausbildung – Events frühzeitig einplanen und Finanzierung klären." },
    { icon: RefreshCw, title: "Regelmässig überprüfen", text: "Den Plan jährlich anpassen: Lebensumstände, Gehaltsentwicklung und Inflation verändern die Prognose." },
  ],
};

function LiquidityWarningModal({
  warningYear,
  affectedYears,
  onClose,
}: {
  warningYear: number;
  affectedYears: number;
  onClose: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const yearsUntil = warningYear - currentYear;
  const urgency = getUrgency(yearsUntil);
  const meta = URGENCY_META[urgency];
  const tips = TIPS[urgency];
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 backdrop-blur px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-semibold text-slate-100">Liquiditäts-Warnung</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Situation */}
          <div className={`rounded-xl border ${meta.border} ${meta.bg} px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className={`h-4 w-4 ${meta.color}`} />
              <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
              <span className="ml-auto text-xs text-slate-500">
                {yearsUntil <= 0 ? "bereits eingetreten" : `in ${yearsUntil} ${yearsUntil === 1 ? "Jahr" : "Jahren"}`}
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Ab <strong className="text-slate-100">{warningYear}</strong> reicht deine Liquidität
              nicht mehr aus, um alle Ausgaben und Verpflichtungen zu decken.
              {affectedYears > 1 && (
                <> Insgesamt sind <strong className="text-slate-100">{affectedYears} Jahre</strong> betroffen.</>
              )}
            </p>
          </div>

          {/* Empfehlungen */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Empfohlene Massnahmen</h3>
            <div className="space-y-3">
              {tips.map((tip, i) => {
                const TipIcon = tip.icon;
                return (
                  <div key={i} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-3">
                    <TipIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200">{tip.title}</div>
                      <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{tip.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kontext-Hinweis */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-400">Tipp:</strong> Passe deine Daten in Silverline an und beobachte,
              wie sich die Prognose verändert. Kleine Anpassungen bei Ausgaben oder Einnahmen
              können langfristig grosse Wirkung zeigen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForecastChartSummary({
  rows = [],
  retirementYear,
}: {
  rows?: YearRow[];
  retirementYear?: number;
}) {
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["key"]>("Gesamt");
  const [showLiqModal, setShowLiqModal] = useState(false);

  const lineData = useMemo(() => {
    const safe = rows ?? [];
    return safe.map((r, i) => {
      const year = Math.round(Number((r as any)?.year ?? 0));
      const end = endBucketsOf(r);
      const eNW = netWorth(end);
      const netVal = eNW.assets - eNW.debts;
      const prevNet =
        i > 0
          ? (() => {
              const pe = endBucketsOf(safe[i - 1]);
              return netWorth(pe).net;
            })()
          : netVal;
      return { year, yearKey: String(year), net: netVal, liq: n(r.liq), prevNet };
    });
  }, [rows]);

  const visiblePeriodOptions = useMemo(() => {
    const n = lineData.length;
    if (n < 4) return [];
    return PERIOD_OPTIONS.filter((o) => {
      if (o.key === "Gesamt") return true;
      if (o.key === "3J") return n >= 4 && n < 6;
      if (o.key === "5J") return n > 5;
      if (o.key === "10J") return n > 10;
      return true;
    });
  }, [lineData.length]);

  const periodOpt = PERIOD_OPTIONS.find((o) => o.key === period) ?? PERIOD_OPTIONS[3];
  const visibleLineData = useMemo(() => {
    if (periodOpt.n <= 0) return lineData;
    return lineData.slice(0, periodOpt.n);
  }, [lineData, periodOpt.n]);

  const lineKpi = useMemo(() => {
    if (visibleLineData.length < 2) return { delta: 0, pct: 0, end: visibleLineData[0]?.net ?? 0 };
    const start = visibleLineData[0].net;
    const end = visibleLineData[visibleLineData.length - 1].net;
    const delta = end - start;
    const pct = start !== 0 ? (delta / start) * 100 : 0;
    return { delta, pct, end };
  }, [visibleLineData]);

  const liqKpi = useMemo(() => {
    if (visibleLineData.length < 2) return { delta: 0, pct: 0 };
    const start = visibleLineData[0].liq;
    const end = visibleLineData[visibleLineData.length - 1].liq;
    const delta = end - start;
    const pct = start !== 0 ? (delta / start) * 100 : 0;
    return { delta, pct };
  }, [visibleLineData]);

  const strokeStops = useMemo(() => buildStrokeGradient(visibleLineData), [visibleLineData]);
  const liqStrokeStops = useMemo(() => buildLiqStrokeGradient(visibleLineData), [visibleLineData]);

  const liqWarnings = useMemo(
    () => visibleLineData.filter((d) => d.liq <= 0),
    [visibleLineData],
  );
  const firstLiqCriticalYear = liqWarnings.length > 0 ? liqWarnings[0].year : null;

  const barMeta = useMemo(() => {
    if (firstLiqCriticalYear == null) return null;
    const yearsUntil = firstLiqCriticalYear - new Date().getFullYear();
    return URGENCY_META[getUrgency(yearsUntil)];
  }, [firstLiqCriticalYear]);
  const retirementYearInt =
    retirementYear == null || !Number.isFinite(Number(retirementYear))
      ? undefined
      : Math.round(Number(retirementYear));
  const retirementMarker = useMemo(() => {
    if (retirementYearInt == null || visibleLineData.length === 0) return null;
    const exact = visibleLineData.find((d) => d.year === retirementYearInt);
    if (exact) return { x: exact.year, label: "Pensionierung" };
    return null;
  }, [retirementYearInt, visibleLineData]);
  const retirementSegment = useMemo(() => {
    if (!retirementMarker || visibleLineData.length === 0) return null;
    const netVals = visibleLineData.map((d) => d.net).filter((v) => Number.isFinite(v));
    if (!netVals.length) return null;
    let minNet = Math.min(...netVals);
    let maxNet = Math.max(...netVals);
    if (minNet === maxNet) {
      minNet -= 1;
      maxNet += 1;
    }
    return {
      x: retirementMarker.x,
      y1: minNet,
      y2: maxNet,
      label: retirementMarker.label,
    };
  }, [retirementMarker, visibleLineData]);

  if (!lineData.length) return null;

  return (
    <div className="rounded-2xl bg-slate-900/35 p-4 shadow-xl ring-1 ring-white/5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Δ Eigenkapital im Zeitraum</div>
          <div className="text-lg font-semibold tabular-nums text-slate-300">
            <span className={lineKpi.delta >= 0 ? "text-emerald-300" : "text-rose-300"}>
              {lineKpi.delta >= 0 ? "+" : ""}
              {formatCHF(lineKpi.delta)} CHF
            </span>
            {lineKpi.pct !== 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({lineKpi.pct >= 0 ? "+" : ""}
                {lineKpi.pct.toFixed(1)} %)
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Δ Liquidität im Zeitraum</div>
          <div className="text-lg font-semibold tabular-nums text-slate-300">
            <span className={liqKpi.delta >= 0 ? "text-emerald-200" : "text-rose-200"}>
              {liqKpi.delta >= 0 ? "+" : ""}
              {formatCHF(liqKpi.delta)} CHF
            </span>
            {liqKpi.pct !== 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({liqKpi.pct >= 0 ? "+" : ""}
                {liqKpi.pct.toFixed(1)} %)
              </span>
            )}
          </div>
        </div>
      </div>

      {firstLiqCriticalYear != null && barMeta != null && (
        <>
          <button
            type="button"
            onClick={() => setShowLiqModal(true)}
            className={`mb-3 flex w-full items-start gap-2 rounded-lg border ${barMeta.barBorder} ${barMeta.barBg} px-3 py-2 text-left text-sm ${barMeta.barText} transition ${barMeta.barHoverBorder} ${barMeta.barHoverBg} cursor-pointer touch-manipulation`}
          >
            <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${barMeta.barIcon}`} />
            <span className="flex-1 font-semibold">Liquidität {firstLiqCriticalYear}</span>
            <span className={`mt-0.5 shrink-0 text-xs ${barMeta.barDetail}`}>{barMeta.label} ›</span>
          </button>
          {showLiqModal && (
            <LiquidityWarningModal
              warningYear={firstLiqCriticalYear}
              affectedYears={liqWarnings.length}
              onClose={() => setShowLiqModal(false)}
            />
          )}
        </>
      )}

      <div className="h-56 min-h-[180px] w-full rounded-xl bg-slate-950/25 ring-1 ring-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visibleLineData} margin={{ top: 28, right: 12, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="areaFillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
              {strokeStops.length > 0 && (
                <linearGradient id="strokeDirectionGrad" x1="0" y1="0" x2="1" y2="0">
                  {strokeStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
              )}
              {strokeStops.length > 0 && (
                <linearGradient id="fillDirectionGrad" x1="0" y1="0" x2="1" y2="0">
                  {strokeStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.12} />
                  ))}
                </linearGradient>
              )}
              {liqStrokeStops.length > 0 && (
                <linearGradient id="liqStrokeDirectionGrad" x1="0" y1="0" x2="1" y2="0">
                  {liqStrokeStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
              )}
            </defs>
            <XAxis
              type="number"
              dataKey="year"
              domain={["dataMin", "dataMax"]}
              allowDecimals={false}
              tickFormatter={(v) => String(Math.trunc(Number(v)))}
              tick={{ fill: "rgba(148,163,184,0.85)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis yAxisId="net" hide domain={["auto", "auto"]} />
            <YAxis yAxisId="liq" hide domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltipContent />} />
            <ReferenceLine yAxisId="net" y={0} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine yAxisId="liq" y={0} stroke="rgba(245,158,11,0.55)" strokeDasharray="4 4" strokeWidth={1} />
            {visibleLineData.length > 0 && (
              <ReferenceLine
                yAxisId="net"
                y={visibleLineData[0].net}
                stroke="rgba(148,163,184,0.25)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Area
              yAxisId="net"
              type="monotone"
              dataKey="net"
              stroke={strokeStops.length > 0 ? "url(#strokeDirectionGrad)" : "#38bdf8"}
              strokeWidth={2.5}
              fill={strokeStops.length > 0 ? "url(#fillDirectionGrad)" : "url(#areaFillGrad)"}
              isAnimationActive={true}
            />
            <Line
              yAxisId="liq"
              type="monotone"
              dataKey="liq"
              stroke={liqStrokeStops.length > 0 ? "url(#liqStrokeDirectionGrad)" : "#6ee7b7"}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={true}
            />
            {retirementSegment && (
              <ReferenceLine
                yAxisId="net"
                segment={[
                  { x: retirementSegment.x, y: retirementSegment.y1 },
                  { x: retirementSegment.x, y: retirementSegment.y2 },
                ]}
                stroke="#f8fafc"
                strokeDasharray="8 4"
                strokeWidth={3}
                label={{
                  value: retirementSegment.label,
                  position: "top",
                  fill: "rgba(248,250,252,0.98)",
                  fontSize: 12,
                  offset: 8,
                }}
              />
            )}
            {liqWarnings.map((d) => (
              <ReferenceDot
                key={`liq-${d.year}`}
                x={d.year}
                yAxisId="liq"
                y={d.liq}
                r={5}
                fill="#fda4af"
                stroke="#fecdd3"
                strokeWidth={2}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {visiblePeriodOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visiblePeriodOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              className={`min-h-11 min-w-11 rounded-lg px-3 py-2 text-xs font-medium transition touch-manipulation ${
                period === opt.key
                  ? "bg-slate-100 text-slate-900"
                  : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
