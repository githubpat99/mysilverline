// app/components/SyncButton.tsx
// Sync-Button Komponente

"use client";

import { useSync } from "@/lib/hooks/useSync";

export function SyncButton() {
  const { isSyncing, isOnline, isAuthenticated, stats, sync, lastSyncResult } = useSync();

  // Nicht anzeigen wenn offline oder nicht eingeloggt
  if (!isOnline || !isAuthenticated) {
    return null;
  }

  const handleSync = async () => {
    const result = await sync();
    if (result && result.ok) {
      console.log("[SyncButton] Sync erfolgreich", result);
    } else if (result) {
      console.error("[SyncButton] Sync fehlgeschlagen", result.error);
    }
  };

  const pendingChanges = stats?.pendingChanges || 0;
  const hasPendingChanges = pendingChanges > 0;

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing || !hasPendingChanges}
      className={`
        px-4 py-2 rounded-md font-medium transition-colors
        ${
          hasPendingChanges
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-300 text-gray-600 cursor-not-allowed"
        }
        ${isSyncing ? "opacity-50 cursor-wait" : ""}
      `}
      title={
        hasPendingChanges
          ? `${pendingChanges} ausstehende Änderung${pendingChanges !== 1 ? "en" : ""}`
          : "Keine ausstehenden Änderungen"
      }
    >
      {isSyncing ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Synchronisiere...
        </span>
      ) : (
        <span>
          {hasPendingChanges ? `Synchronisieren (${pendingChanges})` : "Synchronisiert"}
        </span>
      )}
    </button>
  );
}
