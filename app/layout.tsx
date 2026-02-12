// app/layout.tsx
import type { ReactNode } from "react";
import "./globals.css";
import Header from "./Header";
import { BASE_PATH } from "@/lib/config";

export const metadata = {
  title: "Silverline Demo",
  description: "Next.js + Tailwind Übung",
  icons: {
    icon: `${BASE_PATH}/SL.png`,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-slate-950 text-slate-50 antialiased">
        <Header />
        <main className="px-4 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
