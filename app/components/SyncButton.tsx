"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { runSync, getLastSyncAtExport } from "@/lib/services/syncService";
import { getAuthState } from "@/lib/services/authService";
import SyncStatusBadge from "./SyncStatusBadge";

export default function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(getLastSyncAtExport());

  const handleSync = async () => {
    const { online, hasSession } = await getAuthState();
    if (!online) {
      setMessage("Offline – keine Verbindung.");
      return;
    }
    if (!hasSession) {
      setMessage("Bitte anmelden.");
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const result = await runSync();
      setLastSyncAt(getLastSyncAtExport());
      if (result.ok) {
        setMessage("Synchronisiert.");
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(result.error ?? "Fehler");
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800/60 disabled:opacity-50 disabled:cursor-not-allowed transition"
        title="Mit Server synchronisieren"
      >
        <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Sync…" : "Sync"}
      </button>
      <SyncStatusBadge syncing={syncing} lastSyncAt={lastSyncAt} />
      {message && (
        <span className="text-xs text-slate-400 max-w-[120px] truncate" title={message}>
          {message}
        </span>
      )}
    </div>
  );
}
