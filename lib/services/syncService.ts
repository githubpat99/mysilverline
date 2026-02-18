/**
 * SyncService – Bidirektionale Synchronisation mit WordPress-Backend.
 *
 * Ablauf: Pre-Checks → link-user (falls nötig) → Push → Pull → last_sync_at
 * Nonce wird bei jedem Sync frisch geholt, niemals gecacht.
 */
import { db } from "@/lib/db/schema";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import { SL_API_BASE } from "@/lib/config";
import { getLocalUserId, getAuthState, fetchFreshNonce, isLinked, setLinked } from "./authService";
import { STORAGE_KEYS } from "./storageKeys";
import { saveProfileV2Safe } from "@/lib/profileApiV2";
import { savePositionsSafe } from "@/lib/positionsApi";

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

async function doFetch(
  path: string,
  init: RequestInit & { nonce: string }
): Promise<Response> {
  const { nonce, ...rest } = init;
  const url = path.startsWith("http") ? path : `${NS}${path.startsWith("/") ? "" : "/"}${path}`;
  const hasBody = typeof rest.body !== "undefined";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-WP-Nonce": nonce,
    ...(rest.headers as Record<string, string>),
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return fetch(url, {
    ...rest,
    credentials: "include",
    cache: "no-store",
    headers,
  });
}

export async function runSync(): Promise<SyncResult> {
  const localUserId = getLocalUserId();

  const { online, hasSession } = await getAuthState();
  if (!online) {
    return { ok: false, error: "Offline – bitte Verbindung prüfen." };
  }
  if (!hasSession) {
    return { ok: false, error: "Bitte anmelden, um zu synchronisieren." };
  }

  const nonce = await fetchFreshNonce();
  if (!nonce) {
    return { ok: false, error: "Nonce konnte nicht geladen werden. Bitte Seite neu laden." };
  }

  const result: SyncResult = { ok: true, pushed: { profile: false, positions: false }, pulled: false };

  try {
    if (!isLinked()) {
      const linkRes = await doFetch("/sync/link-user", {
        method: "POST",
        nonce,
        body: JSON.stringify({ local_user_id: localUserId }),
      });
      if (!linkRes.ok) {
        const err = await linkRes.json().catch(() => ({}));
        return { ok: false, error: (err as any)?.message ?? "User-Verknüpfung fehlgeschlagen." };
      }
      setLinked(true);
    }

    const profileRec = await db.profile.get(localUserId);
    const positionRecs = await db.positions
      .where("local_user_id")
      .equals(localUserId)
      .filter((r) => r.sync_status === "local_only" || r.sync_status === "modified")
      .toArray();

    const hasLocalChanges =
      (profileRec && (profileRec.sync_status === "local_only" || profileRec.sync_status === "modified")) ||
      positionRecs.length > 0;

    if (hasLocalChanges) {
      if (profileRec?.data) {
        const saveRes = await saveProfileV2Safe(profileRec.data);
        if (saveRes.ok) {
          result.pushed!.profile = true;
          await db.profile.put({
            ...profileRec,
            sync_status: "synced",
            remote_updated_at: Date.now(),
          });
        } else {
          return { ok: false, error: "Profil konnte nicht hochgeladen werden." };
        }
      }

      if (positionRecs.length > 0) {
        const positions = positionRecs.map((r) => r.data);
        const posRes = await savePositionsSafe(positions);
        if (posRes.ok) {
          result.pushed!.positions = true;
          const now = Date.now();
          for (const r of positionRecs) {
            if (r.id != null) {
              await db.positions.update(r.id, {
                sync_status: "synced",
                remote_updated_at: now,
              });
            }
          }
        } else {
          return { ok: false, error: "Positionen konnten nicht hochgeladen werden." };
        }
      }
    }

    const since = getLastSyncAt() ?? 0;
    const pullRes = await doFetch(`/sync/pull?since=${since}`, { method: "GET", nonce });
    if (pullRes.ok) {
      const pullData = (await pullRes.json().catch(() => null)) as {
        profile?: ProfileV2;
        positions?: PositionDTO[];
        events?: unknown[];
      } | null;

      if (pullData?.profile) {
        await db.profile.put({
          id: localUserId,
          data: pullData.profile,
          sync_status: "synced",
          local_updated_at: Date.now(),
          remote_updated_at: Date.now(),
        });
      }
      if (pullData?.positions && Array.isArray(pullData.positions)) {
        const now = Date.now();
        await db.transaction("rw", db.positions, async () => {
          const existing = await db.positions.where("local_user_id").equals(localUserId).toArray();
          for (const e of existing) {
            if (e.id != null) await db.positions.delete(e.id);
          }
          for (const p of pullData.positions!) {
            const instId = p.id ?? "unknown";
            await db.positions.add({
              local_user_id: localUserId,
              instrument_id: instId,
              data: p,
              sync_status: "synced",
              local_updated_at: now,
              remote_updated_at: now,
            });
          }
        });
      }
      result.pulled = true;
    }

    setLastSyncAt(Date.now());
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync fehlgeschlagen." };
  }
}

export function getLastSyncAtExport(): number | null {
  return getLastSyncAt();
}
