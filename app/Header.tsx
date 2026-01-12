"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { whoAmI, ensureNonce, clearNonce } from "@/lib/profileApi";
import { API_LOGOUT } from "@/lib/endpoints";

type WhoAmI = {
  logged_in: boolean;
  user_id: number;
  name?: string | null;
  email?: string | null;
  roles?: string[];
};

async function fetchWhoAmI() {
  return await whoAmI();
}

async function doLogout() {
  const nonce = await ensureNonce();

  try {
    await fetch(API_LOGOUT, {
      method: "POST",
      credentials: "include",
      headers: nonce ? { "X-WP-Nonce": nonce } : undefined,
      cache: "no-store",
    });
  } finally {
    clearNonce();
    // WICHTIG: auf Seite OHNE silverline_bootstrap
    window.location.href = "https://mysilverline.it-pin.ch/login?logged_out=1";
  }
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState<WhoAmI | null>(null);

  const pathname = usePathname();
  const isFinance = pathname?.startsWith("/finance");
  const isSummary = pathname?.startsWith("/summary");
  const isForecast = pathname?.startsWith("/forecast");

  useEffect(() => {
    let alive = true;

    fetchWhoAmI().then((u) => {
      if (alive) setMe(u);
    });

    return () => {
      alive = false;
    };
  }, []);

  const linkClass = (active: boolean) =>
    [
      "transition",
      active ? "text-sky-400 font-medium" : "text-slate-300 hover:text-sky-400",
    ].join(" ");

  const userLabel =
    me?.logged_in
      ? `✅ ${me.name ?? `User #${me.user_id}`}`
      : "❌ nicht eingeloggt";

  const LogoutBtn = ({ className = "" }: { className?: string }) =>
    me?.logged_in ? (
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          void doLogout();
        }}
        className={["text-slate-300 hover:text-sky-400 transition", className].join(
          " "
        )}
      >
        Abmelden
      </button>
    ) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
        <Link href="/finance" className="text-xl font-semibold tracking-tight">
          <span className="text-sky-400">Silverline</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/finance" className={linkClass(!!isFinance)}>
              Finanz-Workflow
            </Link>

            <Link href="/summary" className={linkClass(!!isSummary)}>
              Bilanz
            </Link>

            <Link href="/forecast?src=finance" className={linkClass(!!isForecast)}>
              Forecast
            </Link>

            <a
              href="https://mysilverline.it-pin.ch"
              className="text-slate-300 hover:text-sky-400 transition"
            >
              Website
            </a>

            <LogoutBtn />
          </nav>
          <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-300">
            {userLabel}
          </span>
        </div>

        <button
          className="md:hidden text-slate-300 hover:text-sky-400"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menü öffnen"
        >
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm text-slate-200 mb-4">
            {userLabel}
          </div>

          <nav className="flex flex-col gap-3 text-sm">
            <Link
              href="/finance"
              className={[linkClass(!!isFinance), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Finanz-Workflow
            </Link>

            <Link
              href="/summary"
              className={[linkClass(!!isSummary), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Bilanz
            </Link>

            <Link
              href="/forecast?src=finance"
              className={[linkClass(!!isForecast), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Forecast
            </Link>
            <a
              href="https://mysilverline.it-pin.ch"
              className="block w-full text-slate-300 hover:text-sky-400 transition"
              onClick={() => setMenuOpen(false)}
            >
              Website
            </a>

            <LogoutBtn className="block w-full text-left" />
          </nav>
        </div>
      )}
    </header>
  );
}
