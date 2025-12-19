"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type WhoAmI = {
  logged_in: boolean;
  user_id: number;
  name?: string | null;
  email?: string | null;
  roles?: string[];
};

async function getNonce(): Promise<string> {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sl_wp_nonce") ?? "";
}

async function fetchWhoAmI(): Promise<WhoAmI> {
  const nonce = await getNonce();

  const res = await fetch(
    "https://mysilverline.it-pin.ch/wp-json/silverline/v1/whoami",
    {
      method: "GET",
      credentials: "include",
      headers: nonce ? { "X-WP-Nonce": nonce } : undefined,
      cache: "no-store",
    }
  );

  const json: any = await res.json().catch(() => null);

  // Wenn WP sagt "nicht eingeloggt", dann ist der lokale Nonce wertlos → löschen
  if (json && typeof json.logged_in === "boolean" && json.logged_in === false) {
    try {
      localStorage.removeItem("sl_wp_nonce");
    } catch { }
  }

  if (json && typeof json.logged_in === "boolean") {
    return json as WhoAmI;
  }

  // Fallback: bei kaputter Antwort ebenfalls Nonce entfernen, um "Geister-Login" zu vermeiden
  try {
    localStorage.removeItem("sl_wp_nonce");
  } catch { }

  return { logged_in: false, user_id: 0, name: null, email: null, roles: [] };
}


async function doLogout() {
  const nonce = localStorage.getItem("sl_wp_nonce") ?? "";

  try {
    await fetch("https://mysilverline.it-pin.ch/wp-json/silverline/v1/logout", {
      method: "POST",
      credentials: "include",
      headers: nonce ? { "X-WP-Nonce": nonce } : undefined,
    });
  } finally {
    localStorage.removeItem("sl_wp_nonce");
    // WICHTIG: auf Seite OHNE silverline_bootstrap
    window.location.href = "https://mysilverline.it-pin.ch/abgemeldet/";
  }
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState<WhoAmI | null>(null);

  const pathname = usePathname();
  const isFinance = pathname?.startsWith("/finance");
  const isSummary = pathname?.startsWith("/summary");

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
        className={[
          "text-slate-300 hover:text-sky-400 transition",
          className,
        ].join(" ")}
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
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/finance" className={linkClass(isFinance)}>
              Finanz-Workflow
            </Link>
            <span className="text-slate-500">/</span>
            <Link href="/summary" className={linkClass(isSummary)}>
              Bilanz
            </Link>
            <span className="text-slate-500">/</span>
            <a
              href="https://mysilverline.it-pin.ch"
              className="text-slate-300 hover:text-sky-400 transition"
            >
              Website
            </a>
            <span className="text-slate-500">/</span>
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
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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
              className={[linkClass(isFinance), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Finanz-Workflow
            </Link>

            <Link
              href="/summary"
              className={[linkClass(isSummary), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Bilanz
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
