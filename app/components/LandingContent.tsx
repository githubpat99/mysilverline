"use client";

import { BASE_PATH } from "@/lib/config";
import InstallHint from "./InstallHint";

const LOGIN_URL = "https://mysilverline.it-pin.ch/login/";

function ChromeInstallIcon({ className = "h-8 w-8 shrink-0 text-slate-400" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <rect x="8" y="4" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M14 28h20M18 28v8M30 28v8M18 36h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 10v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 20L24 26L30 20Z" fill="currentColor" />
    </svg>
  );
}

function AndroidInstallIcon({ className = "h-8 w-8 shrink-0 text-slate-400" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M24 11v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 23L24 31L30 23Z" fill="currentColor" />
    </svg>
  );
}

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
    <a
      href={LOGIN_URL}
      className="inline-flex min-h-12 min-w-[220px] items-center justify-center gap-2 rounded-lg bg-sky-500 px-8 font-medium text-white transition hover:bg-sky-400 touch-manipulation"
    >
      Weiter zur Anmeldung
      <ArrowRightIcon />
    </a>
  );
}

export default function LandingContent() {
  return (
    <>
      {/* PWA: Logo + Button, sofort sichtbar via CSS media query */}
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

      {/* Browser: volle Install-Anleitung */}
      <div className="landing-browser relative mx-auto max-w-md py-12 sm:py-16">
      <InstallHint>
        <div
          className="absolute right-4 top-4 flex items-center gap-2 rounded-lg border border-sky-500/50 bg-slate-800/90 px-3 py-2 text-xs text-sky-300"
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4 shrink-0"
          >
            <path d="M7 17L17 7M17 7h-6M17 7v6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Hier tippen!</span>
        </div>
      </InstallHint>

      <div className="flex flex-col items-center text-center">
        <img
          src={`${BASE_PATH}/SL-logo.png`}
          alt="Silverline"
          width={80}
          height={80}
          className="mb-6 h-20 w-20 object-contain"
        />
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-3xl">
          Installiere{" "}
          <span className="font-bold text-sky-400">JETZT</span>{" "}
          die Silverline App und bring damit deine{" "}
          <span className="font-bold text-sky-400">Finanzen auf Vordermann</span>
        </h1>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-slate-400">
          <span className="flex items-center gap-1.5">
            <AndroidInstallIcon className="h-7 w-7" />
            <span className="text-sm">Android</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ChromeInstallIcon className="h-7 w-7" />
            <span className="text-sm">Chrome</span>
          </span>
          <span className="text-sm">← in der Adresszeile tippen</span>
        </p>

        <section className="mt-8 w-full text-left">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            So installieren Sie die App
          </h2>
          <div className="mt-3 space-y-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm">
            <div>
              <span className="font-medium text-slate-200">iPhone / iPad:</span>
              <p className="mt-0.5 text-slate-400">
                Teilen-Button → „Zum Home-Bildschirm“ → Hinzufügen
              </p>
            </div>
            <div className="flex items-start gap-3">
              <AndroidInstallIcon className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <span className="font-medium text-slate-200">Android:</span>
                <p className="mt-0.5 text-slate-400">
                  Install-Icon (Pfeil im Quadrat) in der Adresszeile tippen
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ChromeInstallIcon className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <span className="font-medium text-slate-200">Chrome:</span>
                <p className="mt-0.5 text-slate-400">
                  Install-Icon (Monitor mit Pfeil) in der Adresszeile tippen
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10">
          <ContinueButton />
        </div>
      </div>
    </div>
    </>
  );
}
