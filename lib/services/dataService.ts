/**
 * DataService – Offline-First Repository.
 *
 * Alle Lese-/Schreiboperationen gehen auf IndexedDB.
 * Synchronisation mit dem Server erfolgt nur explizit via Sync-Button.
 * Beim ersten Laden (lokale DB leer + authentifiziert) wird einmalig
 * automatisch vom Server gezogen.
 */
import { db } from "@/lib/db/schema";
import type { ProfileV2 } from "@/lib/types/v2";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";
import { loadProfileV2 } from "@/lib/profileApiV2";
import { getPositions as apiGetPositions } from "@/lib/api/positionsApi";
import { getLocalUserId, isAuthenticated } from "./authService";
import type { SyncStatus } from "@/lib/db/schema";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";

let _profilePulled = false;
let _positionsPulled = false;

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
      note: null,
      source_account_key: null,
      target_account_key: null,
    },
  ];
}

// ---- Profile ----

export type LoadProfileResult = {
  ok: boolean;
  profile: ProfileV2 | null;
  status?: number;
  raw?: unknown;
};

export async function loadProfile(): Promise<LoadProfileResult> {
  const localUserId = getLocalUserId();

  try {
    const rec = await db.profile.get(localUserId);
    if (rec?.data) {
      return { ok: true, profile: rec.data };
    }

    if (!_profilePulled && (await isAuthenticated())) {
      _profilePulled = true;
      try {
        const remote = await loadProfileV2();
        if (remote.ok && remote.profile) {
          await db.profile.put({
            id: localUserId,
            data: remote.profile,
            sync_status: "synced",
            local_updated_at: Date.now(),
            remote_updated_at: Date.now(),
          });
          return { ok: true, profile: remote.profile };
        }
      } catch (e) {
        console.warn("[DataService] initial pull profile failed:", e);
      }
    }

    return { ok: true, profile: makeEmptyProfileV2() };
  } catch (e) {
    console.error("[DataService] loadProfile failed:", e);
    return { ok: false, profile: null, raw: e };
  }
}

export async function saveProfile(profile: ProfileV2): Promise<LoadProfileResult> {
  const localUserId = getLocalUserId();
  try {
    const existing = await db.profile.get(localUserId);
    if (existing?.data && JSON.stringify(existing.data) === JSON.stringify(profile)) {
      return { ok: true, profile, status: 200 };
    }
    const now = Date.now();
    await db.profile.put({
      id: localUserId,
      data: profile,
      sync_status: "modified",
      local_updated_at: now,
      remote_updated_at: existing?.remote_updated_at ?? null,
    });
    return { ok: true, profile, status: 200 };
  } catch (e) {
    console.error("[DataService] saveProfile failed:", e);
    return { ok: false, profile: null, raw: e };
  }
}

// ---- Positions ----

export async function loadPositions(): Promise<PositionDTO[]> {
  const localUserId = getLocalUserId();

  try {
    const recs = await db.positions
      .where("local_user_id")
      .equals(localUserId)
      .toArray();

    if (recs.length > 0) {
      return recs.map((r) => r.data);
    }

    if (!_positionsPulled && (await isAuthenticated())) {
      _positionsPulled = true;
      try {
        const remote = await apiGetPositions();
        if (remote.length > 0) {
          const now = Date.now();
          await db.transaction("rw", db.positions, async () => {
            for (const p of remote) {
              await db.positions.add({
                local_user_id: localUserId,
                instrument_id: p.id ?? "unknown",
                data: p,
                sync_status: "synced" as SyncStatus,
                local_updated_at: now,
                remote_updated_at: now,
              });
            }
          });
          return remote;
        }
      } catch (e) {
        console.warn("[DataService] initial pull positions failed:", e);
      }
    }

    return getDefaultPositions();
  } catch (e) {
    console.error("[DataService] loadPositions failed:", e);
    return getDefaultPositions();
  }
}

export type SavePositionsResult = {
  ok: boolean;
  status: number;
  data?: { positions: PositionDTO[] };
  raw?: unknown;
};

export async function savePositions(positions: PositionDTO[]): Promise<SavePositionsResult> {
  const localUserId = getLocalUserId();
  try {
    const existingRecs = await db.positions
      .where("local_user_id")
      .equals(localUserId)
      .toArray();

    const oldData = JSON.stringify(existingRecs.map((r) => r.data));
    const newData = JSON.stringify(positions);
    if (oldData === newData) {
      return { ok: true, status: 200, data: { positions } };
    }

    const now = Date.now();
    await db.transaction("rw", db.positions, async () => {
      for (const e of existingRecs) {
        if (e.id != null) await db.positions.delete(e.id);
      }
      for (const p of positions) {
        await db.positions.add({
          local_user_id: localUserId,
          instrument_id: p.id ?? "unknown",
          data: p,
          sync_status: "modified" as SyncStatus,
          local_updated_at: now,
          remote_updated_at: null,
        });
      }
    });
    return { ok: true, status: 200, data: { positions } };
  } catch (e) {
    console.error("[DataService] savePositions failed:", e);
    return { ok: false, status: 0, raw: e };
  }
}
