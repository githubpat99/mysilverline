"use client";

import Link from "next/link";
import { BASE_PATH } from "@/lib/config";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";

function ArrowRightIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function ContinueButton() {
  return (
    <Link
      href="/finance"
      prefetch={false}
      className="inline-flex min-h-12 min-w-[220px] items-center justify-center gap-2 rounded-lg bg-sky-500 px-8 font-medium text-white transition hover:bg-sky-400 touch-manipulation"
    >
      Weiter zur App
      <ArrowRightIcon />
    </Link>
  );
}

/** iOS Safari share icon (square with arrow up) */
function ShareIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 14v5a2 2 0 002 2h12a2 2 0 002-2v-5" />
      <polyline points="12 3 12 15" />
      <polyline points="7 8 12 3 17 8" />
    </svg>
  );
}

function IosInstallGuide() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="space-y-5 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-2 text-slate-200">
            <span className="text-base">1.</span>
            <span className="text-base">Tippe unten auf</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5">
              <ShareIcon className="h-5 w-5 text-sky-400" />
              <span className="text-sm font-medium text-sky-400">Teilen</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-2 text-slate-200">
            <span className="text-base">2.</span>
            <span className="text-base">Wähle</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5">
              <span className="text-lg">+</span>
              <span className="text-sm font-medium">Zum Home-Bildschirm</span>
            </span>
          </div>
        </div>
      </div>

      {/* Animated arrow pointing down to Safari share button */}
      <div className="mt-4 flex flex-col items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-12 w-6 animate-bounce text-sky-400"
        >
          <path d="M12 2v32" />
          <polyline points="5 28 12 36 19 28" />
        </svg>
      </div>
    </div>
  );
}

function InstallButton({ onPrompt }: { onPrompt: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <button
        type="button"
        onClick={onPrompt}
        className="inline-flex min-h-12 min-w-[220px] items-center justify-center gap-2 rounded-lg bg-sky-500 px-8 font-medium text-white transition hover:bg-sky-400 touch-manipulation"
      >
        App installieren
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>
  );
}

function AndroidInstallGuide({ canPrompt, onPrompt, browser }: { canPrompt: boolean; onPrompt: () => void; browser: string }) {
  if (canPrompt) return <InstallButton onPrompt={onPrompt} />;

  if (browser === "samsung") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-slate-200">
          Tippe oben in der Leiste auf:
        </p>
        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5">
          {/* Samsung Internet install icon: rounded rectangle with down arrow */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-sky-400" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9 11l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="8" y1="17" x2="16" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2 text-slate-200">
          <span className="text-base">1.</span>
          <span className="text-base">Tippe oben rechts auf</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-slate-300">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2 text-slate-200">
          <span className="text-base">2.</span>
          <span className="text-base">Wähle</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5">
            <span className="text-sm font-medium">"App installieren"</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Chrome "Installieren" address-bar badge: monitor with down arrow */
function ChromeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-2.5 py-1 shadow-md border border-slate-600">
      {/* Monitor with down-arrow on the right side */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 24" fill="none" className="h-5 w-6 text-sky-400" aria-hidden>
        {/* Monitor */}
        <rect x="1" y="1" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 14h8M8 14v3M12 14v3M8 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* Down arrow on the right */}
        <path d="M24 4v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 12l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs font-medium text-white whitespace-nowrap">Installieren</span>
    </span>
  );
}

function DesktopInstallGuide({ canPrompt, onPrompt }: { canPrompt: boolean; onPrompt: () => void }) {
  if (canPrompt) return <InstallButton onPrompt={onPrompt} />;

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="text-slate-200">
        Klicke oben in der Adresszeile auf:
      </p>
      <ChromeBadge />
    </div>
  );
}

function BrowserInstallView() {
  const { platform, androidBrowser, canPrompt, installed, promptInstall } = useInstallPrompt();

  if (installed) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full border border-emerald-700 bg-emerald-950/40 p-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-lg font-medium text-emerald-300">App installiert!</p>
        <Link
          href="/finance"
          prefetch={false}
          className="mt-2 inline-flex min-h-12 min-w-[220px] items-center justify-center gap-2 rounded-lg bg-sky-500 px-8 font-medium text-white transition hover:bg-sky-400 touch-manipulation"
        >
          Weiter zur App
          <ArrowRightIcon />
        </Link>
      </div>
    );
  }

  return (
    <>
      {platform === "ios" && <IosInstallGuide />}
      {platform === "android" && <AndroidInstallGuide canPrompt={canPrompt} onPrompt={promptInstall} browser={androidBrowser} />}
      {platform === "desktop" && <DesktopInstallGuide canPrompt={canPrompt} onPrompt={promptInstall} />}
    </>
  );
}

export default function LandingContent() {
  return (
    <>
      {/* PWA (standalone): Logo + Weiter-Button */}
      <div className="landing-pwa flex flex-col items-center justify-center py-16 sm:py-24">
        <img
          src={`${BASE_PATH}/SL-logo.png`}
          alt="Silverline"
          width={96}
          height={96}
          className="mb-8 h-24 w-24 object-contain"
        />
        <ContinueButton />
      </div>

      {/* Browser: Install-Zwang, kein Bypass */}
      <div className="landing-browser mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="flex flex-col items-center text-center">
          <img
            src={`${BASE_PATH}/SL-logo.png`}
            alt="Silverline"
            width={80}
            height={80}
            className="mb-6 h-20 w-20 object-contain"
          />

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-3xl">
            Installiere die{" "}
            <span className="font-bold text-sky-400">Silverline</span>{" "}
            App, um fortzufahren
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Die App funktioniert offline und deine Daten sind lokal gespeichert.
          </p>

          <div className="mt-10 w-full">
            <BrowserInstallView />
          </div>
        </div>
      </div>
    </>
  );
}
