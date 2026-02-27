// app/layout.tsx
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import Header from "./Header";
import ConflictQueue from "./components/ConflictQueue";
import OfflineModeOverlay from "./components/OfflineModeOverlay";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import AnalyticsTracker from "./components/AnalyticsTracker";
import {
  ANALYTICS_ENABLED,
  ANALYTICS_HOST_URL,
  ANALYTICS_SCRIPT_URL,
  ANALYTICS_WEBSITE_ID,
  BASE_PATH,
} from "@/lib/config";

export const metadata = {
  title: "Silverline Demo",
  description: "Next.js + Tailwind Übung",
  icons: {
    icon: `${BASE_PATH}/SL-logo.png`,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="manifest" href={`${BASE_PATH}/manifest.webmanifest`} />
        {ANALYTICS_ENABLED && (
          <Script
            defer
            data-website-id={ANALYTICS_WEBSITE_ID}
            data-host-url={ANALYTICS_HOST_URL || undefined}
            src={ANALYTICS_SCRIPT_URL}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="bg-slate-950 text-slate-50 antialiased">
        <AnalyticsTracker />
        <Header />
        <OfflineModeOverlay />
        <ServiceWorkerRegister />
        <main className="px-3 sm:px-6">
          <div className="mb-3">
            <ConflictQueue />
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
