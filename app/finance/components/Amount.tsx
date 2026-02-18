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
      ? "text-2xl sm:text-3xl font-semibold text-slate-100 tabular-nums"
      : "text-sm font-semibold text-slate-100 tabular-nums";

  const curClass =
    size === "lg"
      ? "text-base sm:text-lg font-medium text-slate-400"
      : "text-xs text-slate-400";

  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={numClass}>{formatCHF(value)}</span>
      <span className={curClass}>{currency}</span>
    </span>
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
