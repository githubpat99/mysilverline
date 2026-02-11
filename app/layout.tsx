// app/layout.tsx
import type { ReactNode } from "react";
import "./globals.css";        
import Header from "./Header";

export const metadata = {
  title: "Silverline Demo",
  description: "Next.js + Tailwind Übung",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-slate-950 text-slate-50 antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
