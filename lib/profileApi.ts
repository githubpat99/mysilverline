// src/lib/profileApi.ts
// Silverline UI API client (WP plugin)
// - Nonce in sessionStorage
// - fetchWithNonce with 1 retry on invalid nonce
// - whoAmI without nonce requirement
// - Profile GET/POST mapped to FormState (incl. step1.retireAtAge)

import type { FormState } from "@/lib/types";
import { API_WHOAMI, API_PROFILE, API_NONCE } from "./endpoints";

/* =========================
   Types
   ========================= */

export type WhoAmI = {
  logged_in: boolean;
  user_id: number;
  name?: string | null;
  email?: string | null;
  roles?: string[];
};

type ProfileGetResponse = { ok: true; form: FormState } | { ok: false; error?: string };
type ProfilePostResponse = { ok: true } | { ok: false; error?: string };

/* =========================
   Constants / helpers
   ========================= */

const NONCE_KEY = "sl_wp_nonce";

function isBrowser() {
  return typeof window !== "undefined";
}

function getNonce(): string {
  if (!isBrowser()) return "";
  return sessionStorage.getItem(NONCE_KEY) || "";
}

function setNonce(nonce: string) {
  if (!isBrowser()) return;
  if (nonce) sessionStorage.setItem(NONCE_KEY, nonce);
}

export function clearNonce() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(NONCE_KEY);
}

/** Normalize retireAtAge to backend rules (50–75 else 65). */
export function normalizeRetireAtAge(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 65;
  const r = Math.round(n);
  if (r < 50 || r > 75) return 65;
  return r;
}

/** Defensive normalize FormState to keep UI stable even if backend changes. */
export function normalizeForm(form: FormState): FormState {
  const next: FormState = structuredClone(form);

  if (!next.step1) next.step1 = { cash: "", bankSavings: "", securities: "", otherInvest: "", retireAtAge: 65 } as any;

  // Ensure retireAtAge exists & valid
  (next.step1 as any).retireAtAge = normalizeRetireAtAge((next.step1 as any).retireAtAge ?? 65);

  return next;
}

/* =========================
   Nonce
   ========================= */

export async function ensureNonce(): Promise<string> {
  if (!isBrowser()) return "";

  const existing = getNonce();
  if (existing) return existing;

  const res = await fetch(API_NONCE, {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) return "";

  const json = await res.json().catch(() => null);
  const nonce = json?.nonce ?? "";
  if (nonce) setNonce(nonce);

  return nonce;
}

/* =========================
   fetch with nonce + 1 retry
   ========================= */

async function fetchWithNonce(input: RequestInfo, init: RequestInit = {}) {
  let nonce = await ensureNonce();

  const doFetch = (n: string) => {
    const headers = new Headers(init.headers || {});
    if (n) headers.set("X-WP-Nonce", n);

    return fetch(input, {
      ...init,
      credentials: "include",
      headers,
      cache: "no-store",
    });
  };

  let res = await doFetch(nonce);

  if (!res.ok) {
    // Try to detect WP invalid nonce and retry once
    let code = "";
    try {
      const j = await res.clone().json();
      code = j?.code ?? "";
    } catch {
      // ignore
    }

    if (res.status === 403 && code === "rest_cookie_invalid_nonce") {
      clearNonce();
      nonce = await ensureNonce();
      res = await doFetch(nonce);
    }

    if (res.status === 401 || res.status === 403) {
      // logged out or blocked; nonce might be stale
      clearNonce();
    }
  }

  return res;
}

/* =========================
   whoAmI
   ========================= */

export async function whoAmI(): Promise<WhoAmI> {
  try {
    const res = await fetch(API_WHOAMI, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearNonce();
      return { logged_in: false, user_id: 0 };
    }

    const u = await res.json().catch(() => null);

    // Plugin-Format: { logged_in, user_id, name, email, roles }
    if (u && typeof u.logged_in === "boolean") {
      if (u.logged_in === false) clearNonce();

      return {
        logged_in: !!u.logged_in,
        user_id: Number(u.user_id ?? 0),
        name: u.name ?? null,
        email: u.email ?? null,
        roles: Array.isArray(u.roles) ? u.roles : [],
      };
    }

    clearNonce();
    return { logged_in: false, user_id: 0 };
  } catch {
    // network error / CORS / offline / wrong host -> do not crash UI
    return { logged_in: false, user_id: 0, name: null, email: null, roles: [] };
  }
}

/* =========================
   Profile
   ========================= */

export async function loadProfile(): Promise<FormState | null> {
  const res = await fetchWithNonce(API_PROFILE, { method: "GET" });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as ProfileGetResponse | null;
  if (!json || (json as any).ok !== true || !(json as any).form) return null;

  return normalizeForm((json as any).form as FormState);
}

export async function saveProfile(form: FormState, completedStep = 0): Promise<boolean> {
  const me = await whoAmI();
  if (!me.logged_in || !me.user_id) return false;

  const payload = normalizeForm(form);

  const res = await fetchWithNonce(API_PROFILE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, completed_step: completedStep }),
  });

  if (!res.ok) return false;

  const json = (await res.json().catch(() => null)) as ProfilePostResponse | null;
  if (json && (json as any).ok === true) return true;

  // Some backends just return 200/204 without JSON; treat as ok if status ok
  return res.ok;
}

/* =========================
   Convenience: Source-of-truth retireAtAge from FinWF profile
   ========================= */

export async function loadRetireAtAgeFromProfile(): Promise<number> {
  const form = await loadProfile();
  const v = form?.step1?.retireAtAge ?? 65;
  return normalizeRetireAtAge(v);
}
