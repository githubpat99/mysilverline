// lib/api/positionsApi.ts
// Adds: savePositionsSafe (mirrors saveProfileV2Safe style)
//
// Assumptions (aligned with your existing /profile flow):
// - You already have a /nonce endpoint that returns a REST nonce string
// - You store it in sessionStorage (e.g. "sl_nonce")
// - Your WP REST endpoints accept X-WP-Nonce and Cookie fallback
// - Your API base is same-origin relative to the site that serves /wp-json
//
// If your existing profileApiV2.ts already has a nonce helper, reuse it and delete the helpers below.

import { API_POSITIONS_GET, API_POSITIONS_REPLACE, API_NONCE } from "./endpoints";
import type { PositionDTO } from "@/lib/types/v2/positions.dto";

const POSITIONS_API_ROUTE_GET = API_POSITIONS_GET;
const POSITIONS_API_ROUTE_REPLACE = API_POSITIONS_REPLACE;
const NONCE_API_ROUTE = API_NONCE;

export type ApiResult<T> = {
    ok: boolean;
    status: number;
    data?: T;
    raw?: any;
};

const NONCE_KEY = "sl_nonce";

    async function fetchNonce(): Promise<string | null> {
    try {
        const r = await fetch(NONCE_API_ROUTE, {
            method: "GET",
            credentials: "include",
            headers: { "Accept": "application/json" },
        });
        if (!r.ok) return null;

        const j = await r.json();
        const nonce =
            typeof j === "string"
                ? j
                : typeof j?.nonce === "string"
                    ? j.nonce
                    : typeof j?.data?.nonce === "string"
                        ? j.data.nonce
                        : null;

        if (nonce) sessionStorage.setItem(NONCE_KEY, nonce);
        return nonce;
    } catch {
        return null;
    }
}

async function getNonceCached(): Promise<string | null> {
    try {
        const cached = sessionStorage.getItem(NONCE_KEY);
        if (cached && cached.length > 5) return cached;
    } catch {
        // ignore
    }
    return await fetchNonce();
}

export async function getPositions(): Promise<PositionDTO[]> {
    const nonce = await getNonceCached();

    const r = await fetch(POSITIONS_API_ROUTE_GET, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(nonce ? { "X-WP-Nonce": nonce } : {}),
        },
    });

    if (!r.ok) return [];

    const raw: any = await r.json().catch(() => null);

    // WP plugin style: { ok: true, positions: [...] }
    if (raw && raw.ok === false) return [];

    const out = Array.isArray(raw?.positions) ? raw.positions : Array.isArray(raw) ? raw : [];
    return out;
}


export async function savePositionsSafe(positions: PositionDTO[]): Promise<ApiResult<{ positions: PositionDTO[] }>> {
    const nonce = await getNonceCached();

    try {
        const r = await fetch(POSITIONS_API_ROUTE_REPLACE, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...(nonce ? { "X-WP-Nonce": nonce } : {}),
            },
            body: JSON.stringify({ positions }),
        });

        const status = r.status;
        let raw: any = null;
        const httpOk = r.ok;
        const pluginOk = raw && typeof raw === "object" ? raw.ok !== false : true;

        try {
            raw = await r.json();
        } catch {
            raw = await r.text().catch(() => null);
        }

        if (!httpOk || !pluginOk) {
            // If nonce expired, refresh once and retry
            if (status === 401 || status === 403) {
                const refreshed = await fetchNonce();
                if (refreshed) {
                    const rr = await fetch(POSITIONS_API_ROUTE_REPLACE, {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                            "X-WP-Nonce": refreshed,
                        },
                        body: JSON.stringify({ positions }),
                    });

                    const st2 = rr.status;
                    let raw2: any = null;
                    try {
                        raw2 = await rr.json();
                    } catch {
                        raw2 = await rr.text().catch(() => null);
                    }

                    if (!rr.ok) return { ok: false, status: st2, raw: raw2 };

                    const outPositions =
                        (Array.isArray(raw2) ? raw2 : raw2?.positions) ?? positions;

                    return { ok: true, status: st2, data: { positions: outPositions }, raw: raw2 };
                }
            }

            return { ok: false, status, raw };
        }

        const outPositions =
            Array.isArray(raw?.positions) ? raw.positions :
                Array.isArray(raw) ? raw :
                    positions;

        return { ok: true, status, data: { positions: outPositions }, raw };

    } catch (e: any) {
        return { ok: false, status: 0, raw: { message: String(e?.message ?? e) } };
    }
}
