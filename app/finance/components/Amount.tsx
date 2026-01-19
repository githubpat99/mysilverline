"use client";

import { formatCHF } from "@/lib/format";

export function Amount({
  value,
  currency = "CHF",
  size = "sm",
  align = "right",
}: {
  value: number;
  currency?: string;
  size?: "sm" | "lg";
  align?: "left" | "right";
}) {
  const numClass =
    size === "lg"
      ? "text-2xl sm:text-3xl font-semibold text-slate-100 leading-none tabular-nums"
      : "text-sm font-semibold text-slate-100 leading-none tabular-nums";

  const curClass =
    size === "lg"
      ? "text-base sm:text-xl font-semibold text-slate-100"
      : "text-xs text-slate-300";

  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className={numClass}>{formatCHF(value)}</div>
      <div className={curClass}>{currency}</div>
    </div>
  );
}

export function InlineAmount({
  value,
  currency = "CHF",
}: {
  value: number;
  currency?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{formatCHF(value)}</span>
      <span className="text-slate-400">{currency}</span>
    </span>
  );
}
