"use client";

import { isOfflineMode } from "@/lib/services/authService";

export default function OfflineModeOverlay() {
  if (!isOfflineMode()) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[200] rounded-lg border border-rose-600 bg-rose-950/90 px-3 py-2 text-xs font-medium text-rose-200 shadow-lg"
      role="status"
      aria-live="polite"
    >
      OFFLINE MODE – Nur IndexedDB, keine API
    </div>
  );
}
