"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { runSync, getLastSyncAtExport } from "@/lib/services/syncService";
import { getAuthState, isOfflineMode } from "@/lib/services/authService";
import { db } from "@/lib/db/schema";
import { getLocalUserId } from "@/lib/services/authService";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function hasLocalChanges(): Promise<boolean> {
  try {
    const uid = getLocalUserId();
    if (!uid) return false;
    const profile = await db.profile.get(uid);
    if (profile && (profile.sync_status === "modified" || profile.sync_status === "local_only")) {
      return true;
    }
    const modifiedPos = await db.positions
      .where("local_user_id").equals(uid)
      .filter((r) => r.sync_status === "modified" || r.sync_status === "local_only")
      .count();
    return modifiedPos > 0;
  } catch {
    return false;
  }
}

export default function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [online, setOnline] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLastSyncAt(getLastSyncAtExport());
    if (isOfflineMode()) return;
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    setOnline(isOnline);
    if (isOnline) {
      getAuthState().then((s) => setHasSession(s.hasSession));
    }
    hasLocalChanges().then(setDirty);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => { hasLocalChanges().then(setDirty); }, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleSync = async () => {
    if (syncing) return;
    const auth = await getAuthState();
    if (!auth.online) {
      setMessage("Offline");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    if (!auth.hasSession) {
      setMessage("Nicht angemeldet");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const result = await runSync();
      if (result.ok) {
        window.location.reload();
        return;
      }
      setMessage(result.error ?? "Fehler");
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSyncing(false);
      refresh();
    }
  };

  if (isOfflineMode()) return null;

  const neverSynced = lastSyncAt == null;
  const label = syncing
    ? "Sync…"
    : dirty
      ? "Sync ●"
      : lastSyncAt
        ? formatTime(lastSyncAt)
        : "Sync";

  const colorClass = syncing
    ? "border-sky-600 bg-sky-900/40 text-sky-300"
    : dirty
      ? "border-amber-500/60 bg-amber-950/30 text-amber-300 hover:border-amber-400 hover:bg-amber-900/40"
      : neverSynced && hasSession
        ? "border-rose-600/60 bg-rose-950/30 text-rose-300 hover:border-rose-500 hover:bg-rose-900/40"
        : neverSynced
          ? "border-slate-600 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:bg-slate-700/50"
          : "border-emerald-700/60 bg-emerald-950/30 text-emerald-300 hover:border-emerald-600 hover:bg-emerald-900/40";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing || !online}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed ${colorClass}`}
        title={
          dirty
            ? "Lokale Änderungen vorhanden – klick zum Synchronisieren"
            : lastSyncAt
              ? `Letzter Sync: ${new Date(lastSyncAt).toLocaleString("de-CH")}`
              : "Noch nicht synchronisiert"
        }
      >
        <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
        {label}
      </button>
      {message && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] text-slate-300 shadow-lg z-50">
          {message}
        </div>
      )}
    </div>
  );
}
