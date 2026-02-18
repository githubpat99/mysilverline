// app/components/SyncStatusBadge.tsx
// Sync-Status Badge Komponente (zeigt Online/Offline und Sync-Status)

"use client";

import { useSync } from "@/lib/hooks/useSync";

export function SyncStatusBadge() {
  const { isOnline, isAuthenticated, stats, isSyncing } = useSync();

  const pendingChanges = stats?.pendingChanges || 0;

  // Badge-Farbe basierend auf Status
  let badgeColor = "bg-gray-500"; // Default: Unknown
  let statusText = "Unbekannt";

  if (!isOnline) {
    badgeColor = "bg-red-500";
    statusText = "Offline";
  } else if (!isAuthenticated) {
    badgeColor = "bg-yellow-500";
    statusText = "Gast-Modus";
  } else if (isSyncing) {
    badgeColor = "bg-blue-500 animate-pulse";
    statusText = "Synchronisiere...";
  } else if (pendingChanges > 0) {
    badgeColor = "bg-orange-500";
    statusText = `${pendingChanges} Änderung${pendingChanges !== 1 ? "en" : ""}`;
  } else {
    badgeColor = "bg-green-500";
    statusText = "Synchronisiert";
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded-full ${badgeColor}`} />
      <span className="text-sm text-gray-700">{statusText}</span>
    </div>
  );
}
