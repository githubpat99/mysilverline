/**
 * DataService – Repository-Pattern für Offline-First.
 *
 * Routet alle Lese-/Schreiboperationen:
 * - Online + authentifiziert → WordPress API
 * - Offline ODER Gast ODER NEXT_PUBLIC_OFFLINE_MODE=true → IndexedDB
 *
 * Bestehende Komponenten sollten nur noch diesen Service nutzen.
 */
import { db } from "@/lib/db/schema";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import { loadProfileV2, saveProfileV2Safe } from "@/lib/profileApiV2";
import { getPositions as apiGetPositions } from "@/lib/api/positionsApi";
import { savePositionsSafe } from "@/lib/positionsApi";
import { getLocalUserId, isAuthenticated, isOfflineMode } from "./authService";
import type { SyncStatus } from "@/lib/db/schema";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";

function getDefaultPositions(): PositionDTO[] {
  return [
    {
      id: "liquidity",
      kind: "asset",
      label: "Liquidität",
      bucket: "instant",
      assetType: "other",
      valueCHF: 0,
      annualFlowCHF: null,
      goal: "liq",
      note: null,
      source_account_key: null,
      target_account_key: null,
    },
    {
      id: "debt",
      kind: "debt",
      label: "Schulden",
      bucket: "3m_3y",
      debtType: "other",
      valueCHF: 0,
      annualFlowCHF: null,
      note: null,
      source_account_key: null,
      target_account_key: null,
    },
  ];
}

async function useLocalStore(): Promise<boolean> {
  if (isOfflineMode()) return true;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const auth = await isAuthenticated();
  return !auth;
}

// ---- Profile ----

export type LoadProfileResult = {
  ok: boolean;
  profile: ProfileV2 | null;
  status?: number;
  raw?: unknown;
};

export async function loadProfile(): Promise<LoadProfileResult> {
  const local = await useLocalStore();
  const localUserId = getLocalUserId();

  if (local) {
    try {
      const rec = await db.profile.get(localUserId);
      if (rec?.data) {
        return { ok: true, profile: rec.data };
      }
      const empty = makeEmptyProfileV2();
      return { ok: true, profile: empty };
    } catch (e) {
      console.error("[DataService] loadProfile local failed:", e);
      return { ok: false, profile: null, raw: e };
    }
  }

  return loadProfileV2();
}

export async function saveProfile(profile: ProfileV2): Promise<LoadProfileResult> {
  const local = await useLocalStore();
  const localUserId = getLocalUserId();

  if (local) {
    try {
      const now = Date.now();
      await db.profile.put({
        id: localUserId,
        data: profile,
        sync_status: "modified",
        local_updated_at: now,
        remote_updated_at: null,
      });
      return { ok: true, profile, status: 200 };
    } catch (e) {
      console.error("[DataService] saveProfile local failed:", e);
      return { ok: false, profile: null, raw: e };
    }
  }

  return saveProfileV2Safe(profile);
}

// ---- Positions ----

export async function loadPositions(): Promise<PositionDTO[]> {
  const local = await useLocalStore();
  const localUserId = getLocalUserId();

  if (local) {
    try {
      const recs = await db.positions
        .where("local_user_id")
        .equals(localUserId)
        .toArray();
      if (recs.length === 0) return getDefaultPositions();
      return recs.map((r) => r.data);
    } catch (e) {
      console.error("[DataService] loadPositions local failed:", e);
      return getDefaultPositions();
    }
  }

  return apiGetPositions();
}

export type SavePositionsResult = {
  ok: boolean;
  status: number;
  data?: { positions: PositionDTO[] };
  raw?: unknown;
};

export async function savePositions(positions: PositionDTO[]): Promise<SavePositionsResult> {
  const local = await useLocalStore();
  const localUserId = getLocalUserId();

  if (local) {
    try {
      const now = Date.now();
      await db.transaction("rw", db.positions, async () => {
        const existing = await db.positions
          .where("local_user_id")
          .equals(localUserId)
          .toArray();
        for (const e of existing) {
          if (e.id != null) await db.positions.delete(e.id);
        }
        for (const p of positions) {
          const instId = p.id ?? "unknown";
          await db.positions.add({
            local_user_id: localUserId,
            instrument_id: instId,
            data: p,
            sync_status: "modified" as SyncStatus,
            local_updated_at: now,
            remote_updated_at: null,
          });
        }
      });
      return { ok: true, status: 200, data: { positions } };
    } catch (e) {
      console.error("[DataService] savePositions local failed:", e);
      return { ok: false, status: 0, raw: e };
    }
  }

  return savePositionsSafe(positions);
}
