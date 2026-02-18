// app/components/GuestBanner.tsx
// Banner für Gast-Benutzer

"use client";

import { useSync } from "@/lib/hooks/useSync";
import Link from "next/link";

export function GuestBanner() {
  const { isAuthenticated, isOnline } = useSync();

  // Nur anzeigen wenn NICHT eingeloggt
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm text-yellow-700">
            <strong>Gast-Modus:</strong> Sie arbeiten offline. Ihre Daten werden nur lokal
            gespeichert.{" "}
            {isOnline && (
              <Link href="/api/auth/login" className="font-medium underline">
                Melden Sie sich an
              </Link>
            )}
            {isOnline && " um Ihre Daten zu synchronisieren und auf anderen Geräten zu nutzen."}
            {!isOnline && " Sie sind derzeit offline."}
          </p>
        </div>
      </div>
    </div>
  );
}
