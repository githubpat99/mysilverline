"use client";

type Props = {
  onClick: () => void;
  className?: string;
};

export default function RemoveButton({ onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-10 rounded-xl border border-slate-800 bg-slate-950/40 px-3 text-sm hover:bg-slate-950/60 whitespace-nowrap",
        className,
      ].join(" ")}
    >
      Entfernen
    </button>
  );
}
