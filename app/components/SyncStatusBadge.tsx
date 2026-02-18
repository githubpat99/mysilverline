"use client";

import { useEffect, useState } from "react";
import { getAuthState } from "@/lib/services/authService";
import { getLastSyncAtExport } from "@/lib/services/syncService";
import { isOfflineMode } from "@/lib/services/authService";

type Status = "offline" | "online_unsynced" | "synced" | "syncing" | "offline_mode";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function SyncStatusBadge({
  syncing = false,
  lastSyncAt,
  onRefresh,
}: {
  syncing?: boolean;
  lastSyncAt?: number | null;
  onRefresh?: () => void;
}) {
  const [status, setStatus] = useState<Status>("offline");
  const [lastSync, setLastSync] = useState<number | null>(lastSyncAt ?? null);

  useEffect(() => {
    if (syncing) {
      setStatus("syncing");
      return;
    }
    if (isOfflineMode()) {
      setStatus("offline_mode");
      return;
    }
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    getAuthState().then(({ hasSession }) => {
      const ls = lastSyncAt ?? getLastSyncAtExport();
      setLastSync(ls);
      if (!hasSession) {
        setStatus("online_unsynced");
      } else if (ls != null) {
        setStatus("synced");
      } else {
        setStatus("online_unsynced");
      }
    });
  }, [syncing, lastSyncAt, onRefresh]);

  const labels: Record<Status, string> = {
    offline: "Offline",
    online_unsynced: "Nicht synchronisiert",
    synced: lastSync ? `Sync ${formatTime(lastSync)}` : "Synchronisiert",
    syncing: "Syncing…",
    offline_mode: "OFFLINE MODE",
  };

  const colors: Record<Status, string> = {
    offline: "border-amber-700/60 bg-amber-950/30 text-amber-300",
    online_unsynced: "border-slate-600 bg-slate-800/50 text-slate-300",
    synced: "border-emerald-700/60 bg-emerald-950/30 text-emerald-300",
    syncing: "border-sky-600 bg-sky-900/40 text-sky-300 animate-pulse",
    offline_mode: "border-rose-700/60 bg-rose-950/30 text-rose-300",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs ${colors[status]}`}
      title={lastSync ? `Letzter Sync: ${new Date(lastSync).toLocaleString("de-CH")}` : undefined}
    >
      {labels[status]}
    </span>
  );
}
