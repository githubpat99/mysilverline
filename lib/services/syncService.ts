/**
 * SyncService – Bidirektionale Synchronisation mit WordPress-Backend.
 *
 * Ablauf: Pull → Push (bei lokalen Änderungen) → last_sync_at
 * Link-user und Push-Fehler sind nicht fatal – Pull läuft immer.
 */
import { db } from "@/lib/db/schema";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import { SL_API_BASE } from "@/lib/config";
import { getLocalUserId, getAuthState, isLinked, setLinked } from "./authService";
import { STORAGE_KEYS } from "./storageKeys";
import { getApiHeaders } from "@/lib/profileApi";

const NS = SL_API_BASE?.replace(/\/+$/, "") || "/wp-json/silverline/v1";

export type SyncResult = {
  ok: boolean;
  error?: string;
  pushed?: { profile: boolean; positions: boolean };
  pulled?: boolean;
};

function getLastSyncAt(): number | null {
  if (typeof window === "undefined") return null;
  const s = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_AT);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function setLastSyncAt(ts: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC_AT, String(ts));
}

async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${NS}${path.startsWith("/") ? "" : "/"}${path}`;
  const hasBody = typeof init?.body !== "undefined";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...getApiHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers,
  });
}

async function doPull(localUserId: string): Promise<boolean> {
  try {
    const res = await apiFetch("/sync/pull");
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as {
      profile?: ProfileV2;
      positions?: PositionDTO[];
    } | null;
    if (!data) return false;

    const now = Date.now();

    if (data.profile) {
      await db.profile.put({
        id: localUserId,
        data: data.profile,
        sync_status: "synced",
        local_updated_at: now,
        remote_updated_at: now,
      });
    }

    if (Array.isArray(data.positions) && data.positions.length > 0) {
      await db.transaction("rw", db.positions, async () => {
        const existing = await db.positions.where("local_user_id").equals(localUserId).toArray();
        for (const e of existing) {
          if (e.id != null) await db.positions.delete(e.id);
        }
        for (const p of data.positions!) {
          await db.positions.add({
            local_user_id: localUserId,
            instrument_id: p.id ?? "unknown",
            data: p,
            sync_status: "synced",
            local_updated_at: now,
            remote_updated_at: now,
          });
        }
      });
    }

    return true;
  } catch (e) {
    console.error("[Sync] pull failed:", e);
    return false;
  }
}

async function doPush(localUserId: string): Promise<{ profile: boolean; positions: boolean }> {
  const pushed = { profile: false, positions: false };

  try {
    const profileRec = await db.profile.get(localUserId);
    if (profileRec?.data && (profileRec.sync_status === "local_only" || profileRec.sync_status === "modified")) {
      const res = await apiFetch("/profile-v2", {
        method: "POST",
        body: JSON.stringify({ profile: profileRec.data }),
      });
      if (res.ok) {
        pushed.profile = true;
        await db.profile.put({
          ...profileRec,
          sync_status: "synced",
          remote_updated_at: Date.now(),
        });
      }
    }

    const positionRecs = await db.positions
      .where("local_user_id")
      .equals(localUserId)
      .filter((r) => r.sync_status === "local_only" || r.sync_status === "modified")
      .toArray();

    if (positionRecs.length > 0) {
      const positions = positionRecs.map((r) => r.data);
      const res = await apiFetch("/positions/replace", {
        method: "POST",
        body: JSON.stringify({ positions }),
      });
      if (res.ok) {
        pushed.positions = true;
        const now = Date.now();
        for (const r of positionRecs) {
          if (r.id != null) {
            await db.positions.update(r.id, { sync_status: "synced", remote_updated_at: now });
          }
        }
      }
    }
  } catch (e) {
    console.error("[Sync] push failed:", e);
  }

  return pushed;
}

async function tryLinkUser(localUserId: string): Promise<void> {
  if (isLinked()) return;
  try {
    const res = await apiFetch("/sync/link-user", {
      method: "POST",
      body: JSON.stringify({ local_user_id: localUserId }),
    });
    if (res.ok) setLinked(true);
  } catch {
    // non-fatal
  }
}

export async function runSync(): Promise<SyncResult> {
  const localUserId = getLocalUserId();

  const { online, hasSession } = await getAuthState();
  if (!online) return { ok: false, error: "Offline" };
  if (!hasSession) return { ok: false, error: "Bitte anmelden." };

  const result: SyncResult = { ok: true, pushed: { profile: false, positions: false }, pulled: false };

  // 1. Link user (non-fatal)
  await tryLinkUser(localUserId);

  // 2. Push local changes (non-fatal)
  result.pushed = await doPush(localUserId);

  // 3. Pull from server (always runs)
  result.pulled = await doPull(localUserId);

  if (result.pulled) {
    setLastSyncAt(Date.now());
  } else {
    result.ok = false;
    result.error = "Pull vom Server fehlgeschlagen.";
  }

  return result;
}

export function getLastSyncAtExport(): number | null {
  return getLastSyncAt();
}
