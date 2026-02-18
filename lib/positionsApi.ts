// lib/positionsApi.ts
// Save/Load Positions – nutzt ensureNonce aus profileApi (gleicher Nonce wie profile-v2)

import { API_POSITIONS_GET, API_POSITIONS_REPLACE } from "./endpoints";
import { getApiHeaders, ensureNonce, clearNonce } from "./profileApi";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";

const POSITIONS_API_ROUTE_GET = API_POSITIONS_GET;
const POSITIONS_API_ROUTE_REPLACE = API_POSITIONS_REPLACE;

export type ApiResult<T> = {
    ok: boolean;
    status: number;
    data?: T;
    raw?: any;
};

export async function getPositions(): Promise<PositionDTO[]> {
    const r = await fetch(POSITIONS_API_ROUTE_GET, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json", ...getApiHeaders() },
    });

    if (!r.ok) return [];

    const raw: any = await r.json().catch(() => null);

    // WP plugin style: { ok: true, positions: [...] }
    if (raw && raw.ok === false) return [];

    const out = Array.isArray(raw?.positions) ? raw.positions : Array.isArray(raw) ? raw : [];
    return out;
}


export async function savePositionsSafe(positions: PositionDTO[]): Promise<ApiResult<{ positions: PositionDTO[] }>> {
    let nonce = await ensureNonce();
    if (!nonce) return { ok: false, status: 401, raw: "missing_nonce" };

    const doPost = async (n: string) => {
        const r = await fetch(POSITIONS_API_ROUTE_REPLACE, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...getApiHeaders(),
                "X-WP-Nonce": n,
            },
            body: JSON.stringify({ positions }),
        });
        const raw = await r.json().catch(() => r.text().catch(() => null));
        return { status: r.status, ok: r.ok, raw };
    };

    try {
        let result = await doPost(nonce);

        if (!result.ok && (result.status === 401 || result.status === 403)) {
            clearNonce();
            nonce = await ensureNonce();
            if (nonce) result = await doPost(nonce);
        }

        if (!result.ok) return { ok: false, status: result.status, raw: result.raw };

        const outPositions =
            Array.isArray((result.raw as any)?.positions) ? (result.raw as any).positions :
                Array.isArray(result.raw) ? result.raw : positions;

        return { ok: true, status: result.status, data: { positions: outPositions }, raw: result.raw };
    } catch (e: any) {
        return { ok: false, status: 0, raw: { message: String(e?.message ?? e) } };
    }
}
