// app/layout.tsx
import type { ReactNode } from "react";
import "./globals.css";
import Header from "./Header";
import GuestBanner from "./components/GuestBanner";
import ConflictQueue from "./components/ConflictQueue";
import OfflineModeOverlay from "./components/OfflineModeOverlay";
import { BASE_PATH } from "@/lib/config";

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
      <body className="bg-slate-950 text-slate-50 antialiased">
        <Header />
        <GuestBanner />
        <OfflineModeOverlay />
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
