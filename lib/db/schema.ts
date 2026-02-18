/**
 * Dexie IndexedDB Schema für Offline-First.
 * Spiegelt die logischen MariaDB-Entitäten mit Sync-Metafeldern.
 */
import Dexie from "dexie";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import type { ProfileEvent } from "@/lib/types/v2/events";

export type SyncStatus = "local_only" | "synced" | "modified" | "conflict";

export type ProfileRecord = {
  id: string; // local_user_id
  data: ProfileV2;
  sync_status: SyncStatus;
  local_updated_at: number;
  remote_updated_at: number | null;
};

export type PositionRecord = {
  id?: number; // Dexie auto-increment
  local_user_id: string;
  instrument_id: string;
  data: PositionDTO;
  sync_status: SyncStatus;
  local_updated_at: number;
  remote_updated_at: number | null;
};

export type EventRecord = {
  id?: number;
  local_user_id: string;
  client_id: string;
  data: ProfileEvent;
  sync_status: SyncStatus;
  local_updated_at: number;
  remote_updated_at: number | null;
};

export class OfflineDb extends Dexie {
  profile!: Dexie.Table<ProfileRecord, string>;
  positions!: Dexie.Table<PositionRecord, number>;
  events!: Dexie.Table<EventRecord, number>;

  constructor() {
    super("SilverlineOffline");
    this.version(1).stores({
      profile: "id, local_updated_at, sync_status",
      positions: "++id, [local_user_id+instrument_id], local_user_id, sync_status, local_updated_at",
      events: "++id, [local_user_id+client_id], local_user_id, sync_status, local_updated_at",
    });
  }
}

export const db = new OfflineDb();
