/**
 * Auth-Token-Speicher: localStorage + IndexedDB (Fallback für Android PWA).
 * IndexedDB überlebt oft besser wenn localStorage bei Cold Start leer ist.
 */
const AUTH_TOKEN_KEY = "sl_auth_token";
const DB_NAME = "sl_auth";
const DB_STORE = "kv";

function isBrowser() {
  return typeof window !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result);
    r.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(DB_STORE);
    };
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(DB_STORE, "readonly");
    const s = t.objectStore(DB_STORE);
    const r = s.get(key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result ?? null);
  });
}

function idbSet(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(DB_STORE, "readwrite");
    const s = t.objectStore(DB_STORE);
    const r = s.put(value, key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve();
  });
}

function idbDel(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(DB_STORE, "readwrite");
    const s = t.objectStore(DB_STORE);
    const r = s.delete(key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve();
  });
}

/** Liest Token aus localStorage (synchron). */
export function getAuthToken(): string {
  if (!isBrowser()) return "";
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

/** Speichert Token in localStorage + IndexedDB. */
export function setAuthToken(token: string): void {
  if (!isBrowser() || !token) return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  openDB()
    .then((db) => idbSet(db, AUTH_TOKEN_KEY, token).finally(() => db.close()))
    .catch(() => {});
}

/** Löscht Token aus beiden Speichern. */
export function clearAuthToken(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  openDB()
    .then((db) => idbDel(db, AUTH_TOKEN_KEY).finally(() => db.close()))
    .catch(() => {});
}

/**
 * Stellt Token aus IndexedDB in localStorage wieder her (falls localStorage leer).
 * Vor whoAmI aufrufen – hilft bei Android PWA Cold Start.
 */
export async function restoreTokenFromIndexedDB(): Promise<void> {
  if (!isBrowser() || typeof indexedDB === "undefined") return;
  if (localStorage.getItem(AUTH_TOKEN_KEY)) return;

  try {
    const db = await openDB();
    const token = await idbGet(db, AUTH_TOKEN_KEY);
    db.close();
    if (typeof token === "string" && token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  } catch {
    // ignore
  }
}
