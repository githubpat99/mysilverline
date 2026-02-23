/**
 * Auth-Token-Speicher: localStorage + IndexedDB (Fallback für Android PWA).
 * IndexedDB überlebt oft besser wenn localStorage bei Cold Start leer ist.
 *
 * Token ist immer an einen wp_user_id gebunden. Bei User-Wechsel wird
 * der alte Token verworfen, damit nie der falsche User authentifiziert wird.
 */
const AUTH_TOKEN_KEY = "sl_auth_token";
const AUTH_UID_KEY = "sl_auth_uid";
const DB_NAME = "sl_auth";
const DB_STORE = "kv";

let _clearPending: Promise<void> | null = null;

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

/** Liest gespeicherte WP User ID. */
export function getStoredUserId(): number {
  if (!isBrowser()) return 0;
  const v = localStorage.getItem(AUTH_UID_KEY);
  return v ? parseInt(v, 10) || 0 : 0;
}

/** Speichert Token + User ID in localStorage + IndexedDB. */
export function setAuthToken(token: string, wpUserId?: number): void {
  if (!isBrowser() || !token) return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (wpUserId) localStorage.setItem(AUTH_UID_KEY, String(wpUserId));
  openDB()
    .then((db) =>
      idbSet(db, AUTH_TOKEN_KEY, token)
        .then(() => wpUserId ? idbSet(db, AUTH_UID_KEY, String(wpUserId)) : undefined)
        .finally(() => db.close())
    )
    .catch(() => {});
}

/**
 * Löscht Token aus beiden Speichern.
 * WICHTIG: Gibt ein Promise zurück, damit restoreTokenFromIndexedDB()
 * nicht den alten Token wiederherstellt bevor er gelöscht ist.
 */
export function clearAuthToken(): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_UID_KEY);
  const p = openDB()
    .then((db) =>
      Promise.all([idbDel(db, AUTH_TOKEN_KEY), idbDel(db, AUTH_UID_KEY)])
        .finally(() => db.close())
    )
    .then(() => {})
    .catch(() => {});
  _clearPending = p;
  return p;
}

/**
 * Stellt Token + User ID aus IndexedDB in localStorage wieder her (falls localStorage leer).
 * Wartet auf laufende clear-Operationen, damit kein gelöschter Token zurückkommt.
 */
export async function restoreTokenFromIndexedDB(): Promise<void> {
  if (!isBrowser() || typeof indexedDB === "undefined") return;

  if (_clearPending) {
    await _clearPending;
    _clearPending = null;
  }

  if (localStorage.getItem(AUTH_TOKEN_KEY)) return;

  try {
    const idb = await openDB();
    const token = await idbGet(idb, AUTH_TOKEN_KEY);
    const uid = await idbGet(idb, AUTH_UID_KEY);
    idb.close();
    if (typeof token === "string" && token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    if (typeof uid === "string" && uid) {
      localStorage.setItem(AUTH_UID_KEY, uid);
    }
  } catch {
    // ignore
  }
}
