"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { whoAmI, ensureNonce, clearNonce, clearAuthToken, getApiHeaders } from "@/lib/profileApi";
import { BASE_PATH } from "@/lib/config";
import { API_LOGOUT } from "@/lib/endpoints";
import SyncButton from "./components/SyncButton";

type WhoAmI = {
  logged_in: boolean;
  user_id: number;
  name?: string | null;
  email?: string | null;
  roles?: string[];
  can_edit_musterfall?: boolean;
};

async function fetchWhoAmI() {
  return await whoAmI();
}

async function doLogout() {
  const nonce = await ensureNonce();
  const headers = getApiHeaders();

  try {
    await fetch(API_LOGOUT, {
      method: "POST",
      credentials: "include",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      cache: "no-store",
    });
  } finally {
    clearNonce();
    clearAuthToken();
    // WICHTIG: auf Seite OHNE silverline_bootstrap
    window.location.href = "https://mysilverline.it-pin.ch/login?logged_out=1";
  }
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState<WhoAmI | null>(null);

  const pathname = usePathname();
  const isLanding = pathname === "/" || pathname === "";
  const isBase = pathname?.startsWith("/base");
  const isFinance = pathname?.startsWith("/finance");
  const isSummary = pathname?.startsWith("/summary");
  const isForecast = pathname?.startsWith("/forecast");
  const isMusterfall = pathname?.startsWith("/musterfall");

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

  if (isLanding) return null;

  const isMinimal = !me?.logged_in;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 py-2 sm:px-4 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
        <Link
          href={me?.logged_in ? "/finance" : "/"}
          prefetch={false}
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <img
            src={`${BASE_PATH}/SL-logo.png`}
            alt=""
            className="h-6 w-6 sm:h-7 sm:w-7 object-contain"
          />
          <span className="text-sky-400">Silverline</span>
        </Link>

        {isMinimal ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-300">
            {userLabel}
          </span>
        ) : (
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/base" prefetch={false} className={linkClass(!!isBase)}>
              Basis
            </Link>

            <Link href="/finance" prefetch={false} className={linkClass(!!isFinance)}>
              Finanz-Workflow
            </Link>

            <Link href="/summary" prefetch={false} className={linkClass(!!isSummary)}>
              Bilanz
            </Link>

            <Link
              href="/forecast?src=finance"
              prefetch={false}
              className={linkClass(!!isForecast)}
            >
              Forecast
            </Link>

            <Link
              href="/musterfall"
              prefetch={false}
              className={linkClass(!!isMusterfall)}
            >
              Musterfall
            </Link>

            <a
              href="https://mysilverline.it-pin.ch"
              className="text-slate-300 hover:text-sky-400 transition"
            >
              Website
            </a>

            <LogoutBtn />
          </nav>
          <div className="flex items-center gap-3">
            <SyncButton />
            <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-300">
              {userLabel}
            </span>
          </div>
        </div>
        )}

        {!isMinimal && (
          <button
            className="md:hidden text-slate-300 hover:text-sky-400"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menü öffnen"
          >
            <svg
              className="w-6 h-6 sm:w-7 sm:h-7"
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
        )}
      </div>

      {!isMinimal && menuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden flex flex-col">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 border-b border-slate-800 bg-slate-900 px-3 py-3">
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm text-slate-200">
                {userLabel}
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 -m-2 text-slate-400 hover:text-sky-400 transition"
                aria-label="Menü schliessen"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          <nav className="flex flex-col gap-3 text-sm">
            <Link
              href="/base"
              prefetch={false}
              className={[linkClass(!!isBase), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Basis
            </Link>

            <Link
              href="/finance"
              prefetch={false}
              className={[linkClass(!!isFinance), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Finanz-Workflow
            </Link>

            <Link
              href="/summary"
              prefetch={false}
              className={[linkClass(!!isSummary), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Bilanz
            </Link>

            <Link
              href="/forecast?src=finance"
              prefetch={false}
              className={[linkClass(!!isForecast), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Forecast
            </Link>

            <Link
              href="/musterfall"
              prefetch={false}
              className={[linkClass(!!isMusterfall), "block w-full"].join(" ")}
              onClick={() => setMenuOpen(false)}
            >
              Musterfall
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
        </div>
      )}
    </header>
  );
}

export function WorkflowStepSubnav({
  active,
}: {
  active: "assets" | "debts" | "future";
}) {
  const item = (key: typeof active, label: string, href: string) => (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      className={[
        "text-sm transition",
        active === key ? "text-sky-300" : "text-slate-400 hover:text-slate-200",
      ].join(" ")}
    >
      {label}
    </Link>
  );

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {item("assets", "Vermögen", "/finance?step=1")}
      <span className="text-slate-600">–</span>
      {item("debts", "Verpflichtungen", "/finance?step=2")}
      <span className="text-slate-600">–</span>
      {item("future", "Ein-/Ausgaben", "/finance?step=3")}
    </div>
  );
}

