/**
 * Tests für syncService.ts – User-Wechsel-Erkennung
 *
 * Deckt ab:
 * - Gleicher User: Push + Pull laufen normal
 * - User-Wechsel: lokale Daten werden gelöscht, Push wird übersprungen, nur Pull
 * - Erster Sync (kein vorheriger User): Push + Pull normal
 * - Offline / nicht angemeldet: sofortiger Abbruch
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── localStorage Polyfill ───────────────────────────
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
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, writable: true });

// ─── Mocks ───────────────────────────────────────────

vi.mock("@/lib/config", () => ({
  SL_API_BASE: "/wp-json/silverline/v1",
}));

vi.mock("@/lib/profileApi", () => ({
  getApiHeaders: () => ({}),
}));

const mockGetAuthState = vi.fn();
const mockGetLocalUserId = vi.fn(() => "test-uuid-1234");
const mockIsLinked = vi.fn(() => false);
const mockSetLinked = vi.fn();

vi.mock("./authService", () => ({
  getLocalUserId: () => mockGetLocalUserId(),
  getAuthState: () => mockGetAuthState(),
  isLinked: () => mockIsLinked(),
  setLinked: (v: boolean) => mockSetLinked(v),
}));

const mockGetStoredUserId = vi.fn(() => 0);

vi.mock("@/lib/authTokenStorage", () => ({
  getStoredUserId: () => mockGetStoredUserId(),
}));

// Mock Dexie DB
const mockProfileGet = vi.fn();
const mockProfilePut = vi.fn();
const mockProfileDelete = vi.fn();
const mockPositionsWhere = vi.fn();
const mockPositionsAdd = vi.fn();
const mockPositionsDelete = vi.fn();

const mockPositionsEquals = vi.fn(() => ({
  toArray: vi.fn(() => Promise.resolve([])),
  filter: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
}));

vi.mock("@/lib/db/schema", () => ({
  db: {
    profile: {
      get: (...args: unknown[]) => mockProfileGet(...args),
      put: (...args: unknown[]) => mockProfilePut(...args),
      delete: (...args: unknown[]) => mockProfileDelete(...args),
    },
    positions: {
      where: (...args: unknown[]) => {
        mockPositionsWhere(...args);
        return { equals: mockPositionsEquals };
      },
      add: (...args: unknown[]) => mockPositionsAdd(...args),
      delete: (...args: unknown[]) => mockPositionsDelete(...args),
      transaction: vi.fn(),
    },
    transaction: vi.fn((_mode: string, _table: unknown, fn: () => Promise<void>) => fn()),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function setupFetchOk(pullData = { ok: true, profile: null, positions: [] }) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/sync/link-user")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    }
    if (url.includes("/sync/pull")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(pullData) });
    }
    if (url.includes("/profile-v2") || url.includes("/positions/replace")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    }
    return Promise.resolve({ ok: false });
  });
}

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  mockGetAuthState.mockResolvedValue({ online: true, hasSession: true });
  mockGetLocalUserId.mockReturnValue("test-uuid-1234");
  mockProfileGet.mockResolvedValue(null);
  mockProfilePut.mockResolvedValue(undefined);
  mockProfileDelete.mockResolvedValue(undefined);
  mockPositionsEquals.mockReturnValue({
    toArray: vi.fn(() => Promise.resolve([])),
    filter: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
  });
  setupFetchOk();
});

// Lazy import so mocks are in place
async function getRunSync() {
  const mod = await import("./syncService");
  return mod.runSync;
}

describe("syncService – runSync", () => {
  // ─── Offline / nicht angemeldet ────────────────────
  it("gibt Fehler bei Offline", async () => {
    mockGetAuthState.mockResolvedValue({ online: false, hasSession: false });
    const runSync = await getRunSync();
    const result = await runSync();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Offline");
  });

  it("gibt Fehler wenn nicht angemeldet", async () => {
    mockGetAuthState.mockResolvedValue({ online: true, hasSession: false });
    const runSync = await getRunSync();
    const result = await runSync();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("anmelden");
  });

  // ─── Erster Sync (kein vorheriger User) ────────────
  it("erster Sync: Push + Pull laufen normal", async () => {
    mockGetStoredUserId.mockReturnValue(42);
    // Kein LAST_SYNC_WP_UID gesetzt → erster Sync
    setupFetchOk();

    const runSync = await getRunSync();
    const result = await runSync();

    expect(result.ok).toBe(true);
    expect(result.pulled).toBe(true);
    // link-user und pull wurden aufgerufen
    expect(mockFetch).toHaveBeenCalled();
  });

  // ─── Gleicher User ─────────────────────────────────
  it("gleicher User: Push wird ausgeführt", async () => {
    mockGetStoredUserId.mockReturnValue(42);
    localStorageMock.setItem("sl_last_sync_wp_uid", "42");

    // Lokale Änderungen vorhanden
    mockProfileGet.mockResolvedValue({
      id: "test-uuid-1234",
      data: { base: {} },
      sync_status: "modified",
    });
    setupFetchOk();

    const runSync = await getRunSync();
    const result = await runSync();

    expect(result.ok).toBe(true);
    // Push sollte profile-v2 POST aufrufen
    const pushCalls = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.includes("/profile-v2")
    );
    expect(pushCalls.length).toBeGreaterThan(0);
  });

  // ─── User-Wechsel ──────────────────────────────────
  it("User-Wechsel: lokale Daten werden gelöscht", async () => {
    mockGetStoredUserId.mockReturnValue(99); // neuer User
    localStorageMock.setItem("sl_last_sync_wp_uid", "42"); // alter User

    setupFetchOk();

    const runSync = await getRunSync();
    await runSync();

    // profile.delete sollte aufgerufen worden sein
    expect(mockProfileDelete).toHaveBeenCalledWith("test-uuid-1234");
    // linked Flag wird zurückgesetzt
    expect(mockSetLinked).toHaveBeenCalledWith(false);
  });

  it("User-Wechsel: Push wird NICHT ausgeführt", async () => {
    mockGetStoredUserId.mockReturnValue(99);
    localStorageMock.setItem("sl_last_sync_wp_uid", "42");

    // Lokale Änderungen die NICHT gepusht werden dürfen
    mockProfileGet.mockResolvedValue({
      id: "test-uuid-1234",
      data: { base: { name: "WRONG_USER_DATA" } },
      sync_status: "modified",
    });
    setupFetchOk();

    const runSync = await getRunSync();
    const result = await runSync();

    // Kein Push → kein profile-v2 POST
    const pushCalls = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.includes("/profile-v2") && c[1]?.method === "POST"
    );
    expect(pushCalls.length).toBe(0);
    // Aber Pull läuft trotzdem
    expect(result.pulled).toBe(true);
  });

  it("User-Wechsel: nach Sync wird neuer User als last_sync gespeichert", async () => {
    mockGetStoredUserId.mockReturnValue(99);
    localStorageMock.setItem("sl_last_sync_wp_uid", "42");
    setupFetchOk();

    const runSync = await getRunSync();
    await runSync();

    expect(localStorageMock.getItem("sl_last_sync_wp_uid")).toBe("99");
  });

  // ─── Pull mit Daten ────────────────────────────────
  it("Pull speichert Server-Profil lokal", async () => {
    mockGetStoredUserId.mockReturnValue(42);
    localStorageMock.setItem("sl_last_sync_wp_uid", "42");

    const serverProfile = { base: { birthDate: "1990-01-01" } };
    setupFetchOk({ ok: true, profile: serverProfile as any, positions: [] });

    const runSync = await getRunSync();
    const result = await runSync();

    expect(result.ok).toBe(true);
    expect(result.pulled).toBe(true);
    expect(mockProfilePut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-uuid-1234",
        data: serverProfile,
        sync_status: "synced",
      })
    );
  });
});
