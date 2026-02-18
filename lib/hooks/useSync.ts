// lib/hooks/useSync.ts
// React Hook für Sync-Funktionalität

"use client";

import { useEffect, useState, useCallback } from "react";
import { getSyncService } from "@/lib/services/syncService";
import type { SyncStats, SyncResult } from "@/lib/services/syncService";
import { isAuthenticated, getAuthState } from "@/lib/services/authService";

export type SyncHookState = {
  stats: SyncStats | null;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  isOnline: boolean;
  isAuthenticated: boolean;
};

export function useSync() {
  const [state, setState] = useState<SyncHookState>({
    stats: null,
    isSyncing: false,
    lastSyncResult: null,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isAuthenticated: false,
  });

  // Sync-Stats laden
  const refreshStats = useCallback(async () => {
    const syncService = getSyncService();
    const stats = await syncService.getSyncStats();
    const auth = await isAuthenticated();
    const { online } = await getAuthState();

    setState((prev) => ({
      ...prev,
      stats,
      isOnline: online,
      isAuthenticated: auth,
    }));
  }, []);

  // Initial stats laden
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Online/Offline Events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      refreshStats();
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshStats]);

  // Sync ausführen
  const sync = useCallback(async () => {
    if (state.isSyncing) return;

    setState((prev) => ({ ...prev, isSyncing: true }));

    const syncService = getSyncService();
    const result = await syncService.sync();

    setState((prev) => ({
      ...prev,
      isSyncing: false,
      lastSyncResult: result,
    }));

    await refreshStats();

    return result;
  }, [state.isSyncing, refreshStats]);

  // Pull only
  const pullOnly = useCallback(async () => {
    if (state.isSyncing) return;

    setState((prev) => ({ ...prev, isSyncing: true }));

    const syncService = getSyncService();
    const result = await syncService.pullOnly();

    setState((prev) => ({
      ...prev,
      isSyncing: false,
      lastSyncResult: result,
    }));

    await refreshStats();

    return result;
  }, [state.isSyncing, refreshStats]);

  // Push only
  const pushOnly = useCallback(async () => {
    if (state.isSyncing) return;

    setState((prev) => ({ ...prev, isSyncing: true }));

    const syncService = getSyncService();
    const result = await syncService.pushOnly();

    setState((prev) => ({
      ...prev,
      isSyncing: false,
      lastSyncResult: result,
    }));

    await refreshStats();

    return result;
  }, [state.isSyncing, refreshStats]);

  return {
    ...state,
    sync,
    pullOnly,
    pushOnly,
    refreshStats,
  };
}
