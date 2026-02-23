/**
 * Tests für authTokenStorage.ts
 *
 * Deckt ab:
 * - Token + User-ID-Binding (setAuthToken, getAuthToken, getStoredUserId)
 * - clearAuthToken löscht beides (localStorage + IndexedDB)
 * - restoreTokenFromIndexedDB wartet auf laufende clear-Operationen (Race Condition)
 * - User-Wechsel: alter Token wird nicht wiederhergestellt
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";

// localStorage-Polyfill für Node
const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, "window", { value: globalThis, writable: true });
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

import {
  getAuthToken,
  setAuthToken,
  getStoredUserId,
  clearAuthToken,
  restoreTokenFromIndexedDB,
} from "./authTokenStorage";

beforeEach(async () => {
  localStorageMock.clear();
  // IndexedDB komplett leeren
  const dbs = await indexedDB.databases();
  for (const d of dbs) {
    if (d.name) indexedDB.deleteDatabase(d.name);
  }
});

describe("authTokenStorage", () => {
  // ─── Basics ─────────────────────────────────────────
  describe("getAuthToken / setAuthToken", () => {
    it("gibt leeren String wenn kein Token gesetzt", () => {
      expect(getAuthToken()).toBe("");
    });

    it("speichert und liest Token", () => {
      setAuthToken("tok_abc");
      expect(getAuthToken()).toBe("tok_abc");
    });

    it("speichert Token mit User ID", () => {
      setAuthToken("tok_user42", 42);
      expect(getAuthToken()).toBe("tok_user42");
      expect(getStoredUserId()).toBe(42);
    });

    it("ignoriert leeren Token", () => {
      setAuthToken("tok_old", 1);
      setAuthToken("");
      expect(getAuthToken()).toBe("tok_old");
    });
  });

  // ─── User ID Binding ───────────────────────────────
  describe("getStoredUserId", () => {
    it("gibt 0 wenn keine User ID gesetzt", () => {
      expect(getStoredUserId()).toBe(0);
    });

    it("gibt korrekte User ID nach setAuthToken", () => {
      setAuthToken("tok1", 99);
      expect(getStoredUserId()).toBe(99);
    });

    it("User ID bleibt bei Token-Update ohne neue ID", () => {
      setAuthToken("tok1", 99);
      setAuthToken("tok2");
      expect(getStoredUserId()).toBe(99);
    });

    it("User ID wird bei Token-Update mit neuer ID überschrieben", () => {
      setAuthToken("tok1", 99);
      setAuthToken("tok2", 123);
      expect(getStoredUserId()).toBe(123);
    });
  });

  // ─── clearAuthToken ─────────────────────────────────
  describe("clearAuthToken", () => {
    it("löscht Token und User ID aus localStorage", async () => {
      setAuthToken("tok1", 42);
      expect(getAuthToken()).toBe("tok1");
      expect(getStoredUserId()).toBe(42);

      await clearAuthToken();

      expect(getAuthToken()).toBe("");
      expect(getStoredUserId()).toBe(0);
    });

    it("gibt ein Promise zurück (nicht void)", () => {
      const result = clearAuthToken();
      expect(result).toBeInstanceOf(Promise);
      return result;
    });
  });

  // ─── restoreTokenFromIndexedDB ──────────────────────
  describe("restoreTokenFromIndexedDB", () => {
    it("stellt Token aus IndexedDB wieder her wenn localStorage leer", async () => {
      setAuthToken("tok_idb", 55);
      // Warten bis IndexedDB geschrieben hat
      await new Promise((r) => setTimeout(r, 100));

      // localStorage leeren, IndexedDB behalten
      localStorageMock.removeItem("sl_auth_token");
      localStorageMock.removeItem("sl_auth_uid");
      expect(getAuthToken()).toBe("");

      await restoreTokenFromIndexedDB();

      expect(getAuthToken()).toBe("tok_idb");
      expect(getStoredUserId()).toBe(55);
    });

    it("überschreibt existierenden localStorage-Token NICHT", async () => {
      setAuthToken("tok_idb", 55);
      await new Promise((r) => setTimeout(r, 100));

      // Anderen Token in localStorage setzen
      localStorageMock.setItem("sl_auth_token", "tok_local");

      await restoreTokenFromIndexedDB();

      expect(getAuthToken()).toBe("tok_local");
    });

    it("wartet auf laufende clear-Operation (Race Condition Fix)", async () => {
      setAuthToken("tok_stale", 10);
      await new Promise((r) => setTimeout(r, 100));

      // clear starten (async, schreibt in IndexedDB)
      const clearPromise = clearAuthToken();

      // SOFORT restore aufrufen, BEVOR clear fertig ist
      await restoreTokenFromIndexedDB();

      // Token darf NICHT zurückkommen
      expect(getAuthToken()).toBe("");
      expect(getStoredUserId()).toBe(0);

      await clearPromise;
    });
  });

  // ─── User-Wechsel Szenario ─────────────────────────
  describe("User-Wechsel Szenario", () => {
    it("nach clear + setAuthToken mit neuem User: alter Token kommt nicht zurück", async () => {
      // User A einloggen
      setAuthToken("tok_userA", 100);
      await new Promise((r) => setTimeout(r, 100));

      // User A ausloggen
      await clearAuthToken();
      expect(getAuthToken()).toBe("");
      expect(getStoredUserId()).toBe(0);

      // User B einloggen
      setAuthToken("tok_userB", 200);
      expect(getAuthToken()).toBe("tok_userB");
      expect(getStoredUserId()).toBe(200);
    });

    it("nach clear + localStorage-Wipe: restore holt NICHT den alten Token", async () => {
      setAuthToken("tok_old_user", 50);
      await new Promise((r) => setTimeout(r, 100));

      await clearAuthToken();
      await new Promise((r) => setTimeout(r, 100));

      // Simuliere PWA Cold Start: localStorage ist leer
      localStorageMock.clear();

      await restoreTokenFromIndexedDB();

      // Alter Token darf nicht zurückkommen
      expect(getAuthToken()).toBe("");
    });
  });
});
