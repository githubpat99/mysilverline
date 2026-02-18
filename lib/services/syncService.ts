/**
 * SyncService – Bidirektionale Synchronisation zwischen IndexedDB und WordPress Backend.
 *
 * Features:
 * - Push: Lokale Änderungen zum Server senden
 * - Pull: Server-Daten nach lokal holen
 * - Conflict Resolution: Last-Write-Wins basierend auf updated_at Timestamps
 * - Batch Sync: Alle Daten in einer Operation synchronisieren
 *
 * WICHTIG: Sync funktioniert NUR für eingeloggte User, nicht für Gäste!
 */

import { db } from "@/lib/db/schema";
import type { ProfileRecord, PositionRecord, EventRecord, SyncStatus } from "@/lib/db/schema";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import type { ProfileEvent } from "@/lib/types/v2/events";
import { loadProfileV2, saveProfileV2Safe } from "@/lib/profileApiV2";
import { getPositions as apiGetPositions, savePositionsSafe } from "@/lib/positionsApi";
import { getLocalUserId, isAuthenticated, fetchFreshNonce } from "./authService";
import { SL_API_BASE } from "@/lib/config";

// ========================================
// Types
// ========================================

export type SyncResult = {
  ok: boolean;
  error?: string;
  pulledAt?: number;
  pushedAt?: number;
  conflicts?: ConflictRecord[];
};

export type ConflictRecord = {
  type: "profile" | "positions" | "events";
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  resolution: "local_won" | "remote_won";
};

export type SyncStats = {
  pendingChanges: number;
  lastSyncAt: number | null;
  syncStatus: "idle" | "syncing" | "error";
};

// ========================================
// Sync Service
// ========================================

export class SyncService {
  private localUserId: string;
  private isSyncing = false;

  constructor() {
    this.localUserId = getLocalUserId();
  }

  /**
   * Vollständige Synchronisation: Push → Pull
   * @returns SyncResult mit Erfolgs-Status und optionalen Konflikten
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { ok: false, error: "sync_already_running" };
    }

    const auth = await isAuthenticated();
    if (!auth) {
      return { ok: false, error: "not_authenticated" };
    }

    this.isSyncing = true;
    const conflicts: ConflictRecord[] = [];

    try {
      // SCHRITT 1: Push lokale Änderungen zum Server
      const pushResult = await this.push();
      if (!pushResult.ok) {
        this.isSyncing = false;
        return { ok: false, error: `push_failed: ${pushResult.error}` };
      }

      // SCHRITT 2: Pull Server-Daten nach lokal
      const pullResult = await this.pull();
      if (!pullResult.ok) {
        this.isSyncing = false;
        return { ok: false, error: `pull_failed: ${pullResult.error}` };
      }

      if (pullResult.conflicts) {
        conflicts.push(...pullResult.conflicts);
      }

      this.isSyncing = false;
      return {
        ok: true,
        pulledAt: pullResult.pulledAt,
        pushedAt: pushResult.pushedAt,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };
    } catch (e: any) {
      this.isSyncing = false;
      return { ok: false, error: e.message || "unknown_error" };
    }
  }

  /**
   * Push: Lokale Änderungen zum Server senden
   */
  private async push(): Promise<SyncResult> {
    const now = Date.now();

    try {
      // Profile pushen
      const profileRec = await db.profile.get(this.localUserId);
      if (profileRec && profileRec.sync_status === "modified") {
        const result = await saveProfileV2Safe(profileRec.data);
        if (!result.ok) {
          return { ok: false, error: "profile_push_failed" };
        }
        // Status auf "synced" setzen
        await db.profile.update(this.localUserId, {
          sync_status: "synced",
          remote_updated_at: now,
        });
      }

      // Positions pushen
      const positionRecs = await db.positions
        .where("local_user_id")
        .equals(this.localUserId)
        .and((r) => r.sync_status === "modified")
        .toArray();

      if (positionRecs.length > 0) {
        const positions = positionRecs.map((r) => r.data);
        const result = await savePositionsSafe(positions);
        if (!result.ok) {
          return { ok: false, error: "positions_push_failed" };
        }
        // Status auf "synced" setzen
        for (const rec of positionRecs) {
          if (rec.id != null) {
            await db.positions.update(rec.id, {
              sync_status: "synced",
              remote_updated_at: now,
            });
          }
        }
      }

      // TODO: Events pushen (wenn Backend-Endpoint existiert)
      // Aktuell werden Events nur in profileV2 gespeichert

      return { ok: true, pushedAt: now };
    } catch (e: any) {
      return { ok: false, error: e.message || "push_error" };
    }
  }

  /**
   * Pull: Server-Daten nach lokal holen
   * Verwendet Last-Write-Wins basierend auf updated_at Timestamps
   */
  private async pull(): Promise<SyncResult> {
    const now = Date.now();
    const conflicts: ConflictRecord[] = [];

    try {
      // Profile pullen
      const profileResult = await loadProfileV2();
      if (profileResult.ok && profileResult.profile) {
        const remoteProfile = profileResult.profile;
        const localRec = await db.profile.get(this.localUserId);

        if (localRec) {
          // Conflict-Check: Last-Write-Wins
          const localUpdated = localRec.local_updated_at;
          const remoteUpdated = localRec.remote_updated_at || 0;

          // Wenn lokal neuere Änderungen: Konflikt! (sollte nicht passieren nach Push)
          if (localRec.sync_status === "modified" && localUpdated > remoteUpdated) {
            conflicts.push({
              type: "profile",
              localUpdatedAt: localUpdated,
              remoteUpdatedAt: now,
              resolution: "local_won", // Lokal gewonnen (bereits gepusht)
            });
          } else {
            // Remote gewinnt: Überschreiben
            await db.profile.put({
              id: this.localUserId,
              data: remoteProfile,
              sync_status: "synced",
              local_updated_at: now,
              remote_updated_at: now,
            });
          }
        } else {
          // Kein lokaler Record: Einfach einfügen
          await db.profile.put({
            id: this.localUserId,
            data: remoteProfile,
            sync_status: "synced",
            local_updated_at: now,
            remote_updated_at: now,
          });
        }
      }

      // Positions pullen
      const remotePositions = await apiGetPositions();
      if (remotePositions.length > 0) {
        // Replace-All Strategie (wie Backend)
        await db.transaction("rw", db.positions, async () => {
          // Alte Positionen löschen
          const oldPositions = await db.positions
            .where("local_user_id")
            .equals(this.localUserId)
            .toArray();

          for (const oldPos of oldPositions) {
            if (oldPos.id != null) {
              await db.positions.delete(oldPos.id);
            }
          }

          // Neue Positionen einfügen
          for (const pos of remotePositions) {
            await db.positions.add({
              local_user_id: this.localUserId,
              instrument_id: pos.id,
              data: pos,
              sync_status: "synced",
              local_updated_at: now,
              remote_updated_at: now,
            });
          }
        });
      }

      // TODO: Events pullen (wenn Backend-Endpoint existiert)

      return { ok: true, pulledAt: now, conflicts: conflicts.length > 0 ? conflicts : undefined };
    } catch (e: any) {
      return { ok: false, error: e.message || "pull_error" };
    }
  }

  /**
   * Nur Pull (ohne Push): Server-Daten herunterladen und lokal überschreiben
   * Nützlich beim ersten Login oder Force-Refresh
   */
  async pullOnly(): Promise<SyncResult> {
    const auth = await isAuthenticated();
    if (!auth) {
      return { ok: false, error: "not_authenticated" };
    }

    return await this.pull();
  }

  /**
   * Nur Push (ohne Pull): Lokale Änderungen zum Server senden
   * Nützlich für Offline-to-Online Übergang
   */
  async pushOnly(): Promise<SyncResult> {
    const auth = await isAuthenticated();
    if (!auth) {
      return { ok: false, error: "not_authenticated" };
    }

    return await this.push();
  }

  /**
   * Sync-Status abfragen
   * @returns Anzahl ausstehender Änderungen und letzter Sync-Zeitpunkt
   */
  async getSyncStats(): Promise<SyncStats> {
    const profileRec = await db.profile.get(this.localUserId);
    const positionRecs = await db.positions
      .where("local_user_id")
      .equals(this.localUserId)
      .and((r) => r.sync_status === "modified")
      .count();

    const profileModified = profileRec?.sync_status === "modified" ? 1 : 0;
    const pendingChanges = profileModified + positionRecs;

    const lastSyncAt = profileRec?.remote_updated_at || null;

    return {
      pendingChanges,
      lastSyncAt,
      syncStatus: this.isSyncing ? "syncing" : "idle",
    };
  }

  /**
   * Markiert alle lokalen Daten als "modified" (für Test-Zwecke)
   */
  async markAllAsModified(): Promise<void> {
    const profileRec = await db.profile.get(this.localUserId);
    if (profileRec) {
      await db.profile.update(this.localUserId, { sync_status: "modified" });
    }

    const positionRecs = await db.positions.where("local_user_id").equals(this.localUserId).toArray();
    for (const rec of positionRecs) {
      if (rec.id != null) {
        await db.positions.update(rec.id, { sync_status: "modified" });
      }
    }
  }
}

// ========================================
// Factory & Singleton
// ========================================

let syncServiceInstance: SyncService | null = null;

/**
 * Singleton SyncService Instanz
 */
export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

/**
 * Reset Singleton (für Tests)
 */
export function resetSyncService(): void {
  syncServiceInstance = null;
}
