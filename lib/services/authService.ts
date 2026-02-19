/**
 * AuthService – Authentifizierung und Offline-Gastbenutzer.
 *
 * - getLocalUserId(): UUID v4 aus localStorage (persistent, bei erstem Besuch generiert)
 * - getAuthState(): Prüft Online + Session-Cookie (whoami)
 * - getNonce(): Frische Nonce vom Server – NIEMALS cachen
 * - isAuthenticated(): Session vorhanden UND Nonce gültig
 *
 * Im Offline-Modus: Keine API-Calls, nur Local-UserId.
 */
import { SL_API_BASE } from "@/lib/config";
import { STORAGE_KEYS, uuidv4 } from "./storageKeys";
import { getApiHeaders } from "@/lib/profileApi";

const NS = SL_API_BASE?.replace(/\/+$/, "") || "/wp-json/silverline/v1";
const WHOAMI_URL = `${NS}/whoami`;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Liefert die lokale Gastbenutzer-UUID. Generiert sie beim ersten Aufruf.
 */
export function getLocalUserId(): string {
  if (!isBrowser()) return "";
  let id = localStorage.getItem(STORAGE_KEYS.LOCAL_USER_ID);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(STORAGE_KEYS.LOCAL_USER_ID, id);
  }
  return id;
}

/**
 * Prüft, ob der User mit dem WordPress-Backend verknüpft ist.
 */
export function isLinked(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(STORAGE_KEYS.LINKED) === "true";
}

export function setLinked(value: boolean): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.LINKED, value ? "true" : "false");
}

/**
 * Prüft Online-Status + Session-Cookie (via leichtgewichtigen Fetch).
 * Wirft nicht, gibt false bei Fehler zurück.
 */
export async function getAuthState(): Promise<{
  online: boolean;
  hasSession: boolean;
}> {
  if (!isBrowser()) {
    return { online: false, hasSession: false };
  }
  const online = navigator.onLine;
  if (!online) {
    return { online: false, hasSession: false };
  }
  try {
    const res = await fetch(WHOAMI_URL, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", ...getApiHeaders() },
    });
    if (!res.ok) return { online: true, hasSession: false };
    const json = (await res.json().catch(() => null)) as { logged_in?: boolean } | null;
    return { online: true, hasSession: json?.logged_in === true };
  } catch {
    return { online: true, hasSession: false };
  }
}

/**
 * Holt eine frische Nonce vom Server. NIEMALS lokal speichern.
 * Gibt leeren String bei Fehler zurück.
 */
export async function fetchFreshNonce(): Promise<string> {
  if (!isBrowser()) return "";
  const url = `${NS}/nonce`;
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", ...getApiHeaders() },
    });
    if (!res.ok) return "";
    const json = (await res.json().catch(() => null)) as { nonce?: string } | null;
    return (json?.nonce ?? "") as string;
  } catch {
    return "";
  }
}

/**
 * Prüft, ob eine gültige Session UND Nonce vorhanden sind.
 * Vereinfacht: online + Session reicht für Leseoperationen;
 * für Schreiboperationen/Sync wird frische Nonce benötigt.
 */
export async function isAuthenticated(): Promise<boolean> {
  const { online, hasSession } = await getAuthState();
  return online && hasSession;
}

/**
 * Prüft, ob der Offline-Testing-Modus aktiv ist.
 */
export function isOfflineMode(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.NEXT_PUBLIC_OFFLINE_MODE === "true";
}
