// lib/profileApiV2.ts
// Single place for Silverline API calls (whoami / nonce / profile-v2)
// - GETs do NOT require nonce
// - POST /profile-v2 requires nonce (with 1 retry on 401/403)
// - Robust parsing: never crash on HTML/empty/non-JSON responses

import { parseProfileV2 } from "@/lib/validation/v2/profile.schema";
import type { ProfileV2 } from "@/lib/types/v2";
import type { StepId, FormState } from "@/lib/types";

// ---- Endpoints (relativ, da du im WP-Kontext läufst)
const API_WHOAMI = "/wp-json/silverline/v1/whoami";
const API_NONCE = "/wp-json/silverline/v1/nonce";
const API_PROFILE_V2 = "/wp-json/silverline/v1/profile-v2";

// Legacy (falls du es noch brauchst; sonst kannst du saveProfile löschen)
const API_PROFILE_LEGACY = "/wp-json/silverline/v1/profile";

// ---- Nonce Storage (sessionStorage)
const NONCE_KEY = "sl_wp_nonce";

function getNonce(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(NONCE_KEY) ?? "";
}

function setNonce(nonce: string) {
  if (typeof window === "undefined") return;
  if (!nonce) return;
  sessionStorage.setItem(NONCE_KEY, nonce);
}

function clearNonce() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(NONCE_KEY);
}

export type WhoAmI = {
  logged_in: boolean;
  user_id: number;
  name?: string | null;
  email?: string | null;
  roles?: string[];
};

export type ApiErrorCode =
  | "http_error"
  | "network_error"
  | "invalid_json"
  | "invalid_profile"
  | "unknown";

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function safeReadJson(res: Response): Promise<any | null> {
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}

/**
 * fetchJson:
 * - always credentials include (WP cookies)
 * - cache no-store (keine komischen Zwischenstände)
 * - sets Content-Type only if body exists (vermeidet unnötige Header bei GET)
 * Throws ApiError on non-2xx.
 */
export async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<{ res: Response; json: any | null; text: string }> {
  let res: Response;

  try {
    const hasBody = typeof init?.body !== "undefined";
    const headers: Record<string, string> = {
      ...(init?.headers as any),
      ...(hasBody ? { "content-type": "application/json" } : {}),
    };

    res = await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers,
    });
  } catch (e) {
    throw new ApiError("network_error", "Network error", 0, e);
  }

  const text = await safeReadText(res);
  const json = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;

  if (!res.ok) {
    // include both json + text snippet for debugging
    throw new ApiError("http_error", `HTTP ${res.status}`, res.status, {
      url,
      json,
      text: text.slice(0, 500),
    });
  }

  return { res, json, text };
}

// ---- Nonce sicherstellen (nur für POST/PUT/DELETE nötig)
export async function ensureNonce(): Promise<string> {
  const existing = getNonce();
  if (existing) return existing;

  const { json } = await fetchJson(API_NONCE, { method: "GET" });
  const nonce = typeof json?.nonce === "string" ? json.nonce : "";
  if (nonce) setNonce(nonce);
  return nonce;
}

export async function whoAmI(): Promise<WhoAmI> {
  try {
    const { json } = await fetchJson(API_WHOAMI, { method: "GET" });

    if (json && typeof json.logged_in === "boolean" && typeof json.user_id === "number") {
      return json as WhoAmI;
    }
    return { logged_in: false, user_id: 0, name: null, email: null, roles: [] };
  } catch {
    // whoami ist “soft”: wenn es scheitert, ist user für UI einfach nicht logged in
    return { logged_in: false, user_id: 0, name: null, email: null, roles: [] };
  }
}

export async function loadProfileV2(): Promise<{
  ok: boolean;
  status: number;
  profile: ProfileV2 | null;
  raw?: any;
}> {
  try {
    const { res, json, text } = await fetchJson(API_PROFILE_V2, { method: "GET" });

    if (!json || !("profile" in json)) {
      console.error("Profile payload missing", { status: res.status, json, text: text.slice(0, 300) });
      return { ok: false, status: res.status, profile: null, raw: json ?? text };
    }

    if (!json.profile) return { ok: true, status: res.status, profile: null, raw: json };

    try {
      const profile = parseProfileV2(json.profile) as ProfileV2;
      return { ok: true, status: res.status, profile, raw: json };
    } catch (e) {
      console.error("Profile parse failed", e);
      return { ok: false, status: res.status, profile: null, raw: json };
    }
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0;
    return { ok: false, status, profile: null, raw: e instanceof ApiError ? e.details : e };
  }
}

/**
 * saveProfileV2Safe:
 * - ensures nonce
 * - POST /profile-v2
 * - retries once on 401/403 by refreshing nonce
 */
export async function saveProfileV2Safe(profile: ProfileV2): Promise<{
  ok: boolean;
  status: number;
  profile: ProfileV2 | null;
  raw?: any;
}> {
  const doPost = async (nonce: string) => {
    return await fetchJson(API_PROFILE_V2, {
      method: "POST",
      headers: {
        // WP akzeptiert case-insensitive; wir verwenden konsistent lower-case
        "x-wp-nonce": nonce,
      },
      body: JSON.stringify({ profile }),
    });
  };

  try {
    let nonce = await ensureNonce();
    if (!nonce) return { ok: false, status: 401, profile: null, raw: "missing_nonce" };

    let { res, json } = await doPost(nonce);

    // Erfolgscontract: { ok:true, profile: {...} }
    const savedRaw = json?.profile ?? null;

    if (!savedRaw) return { ok: true, status: res.status, profile: null, raw: json };

    try {
      const saved = parseProfileV2(savedRaw) as ProfileV2;

      return { ok: true, status: res.status, profile: saved, raw: json };
    } catch {
      // Falls Backend mal anders liefert: nicht crashen
      return { ok: true, status: res.status, profile: null, raw: json };
    }
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      // retry once with fresh nonce
      try {
        clearNonce();
        const fresh = await ensureNonce();
        if (!fresh) return { ok: false, status: e.status, profile: null, raw: e.details };

        const { res, json } = await fetchJson(API_PROFILE_V2, {
          method: "POST",
          headers: { "x-wp-nonce": fresh },
          body: JSON.stringify({ profile }),
        });

        const savedRaw = json?.profile ?? null;
        const saved = savedRaw ? (parseProfileV2(savedRaw) as ProfileV2) : null;
        return { ok: true, status: res.status, profile: saved, raw: json };
      } catch (e2) {
        const status2 = e2 instanceof ApiError ? e2.status : 0;
        return { ok: false, status: status2, profile: null, raw: e2 instanceof ApiError ? e2.details : e2 };
      }
    }

    const status = e instanceof ApiError ? e.status : 0;
    return { ok: false, status, profile: null, raw: e instanceof ApiError ? e.details : e };
  }
}

// ---- Legacy (optional)
export async function saveProfile(
  form: FormState,
  step: StepId
): Promise<{ ok: boolean; status?: number; details?: any }> {
  try {
    await fetchJson(API_PROFILE_LEGACY, {
      method: "POST",
      body: JSON.stringify({ step, form }),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, status: e.status, details: e.details };
    return { ok: false, status: 0, details: e };
  }
}
