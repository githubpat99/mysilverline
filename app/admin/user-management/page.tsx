"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SL_API_BASE } from "@/lib/config";
import { getApiHeaders, whoAmI } from "@/lib/profileApi";

const API = `${SL_API_BASE || "/wp-json/silverline/v1"}/admin/users/delete`;
const API_LIST = `${SL_API_BASE || "/wp-json/silverline/v1"}/admin/users/list`;

type AdminDeleteResponse = {
  ok: boolean;
  error?: string;
  dry_run?: boolean;
  user?: { id: number; login: string; email: string };
  dependencies?: Array<{ table: string; exists: boolean; count: number }>;
  deleted_user_id?: number;
  dependencies_deleted?: Array<{ table: string; exists: boolean; deleted: number }>;
};
type AdminListResponse = {
  ok: boolean;
  error?: string;
  users?: Array<{ id: number; login: string; email: string; name: string; roles: string[] }>;
};

export default function AdminUserManagementPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; login: string; email: string; name: string; roles: string[] }>>([]);
  const [result, setResult] = useState<AdminDeleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    whoAmI()
      .then((me) => {
        if (!alive) return;
        const roles = Array.isArray(me.roles) ? me.roles : [];
        setAllowed(me.logged_in === true && roles.includes("administrator"));
      })
      .catch(() => {
        if (alive) setAllowed(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const headers = getApiHeaders();
      const res = await fetch(API_LIST, {
        method: "GET",
        credentials: "include",
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      const json = (await res.json().catch(() => null)) as AdminListResponse | null;
      if (!res.ok || !json || !json.ok || !Array.isArray(json.users)) {
        setUsers([]);
        setError(json?.error || "Userliste konnte nicht geladen werden.");
        return;
      }
      setUsers(json.users);
      if (json.users.length === 0) {
        setIdentifier("");
      } else if (!json.users.some((u) => String(u.id) === identifier)) {
        setIdentifier(String(json.users[0].id));
      }
    } catch {
      setUsers([]);
      setError("Userliste konnte nicht geladen werden.");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    if (allowed !== true) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const canDelete = useMemo(
    () => identifier.trim().length > 0 && confirmText.trim().toUpperCase() === "DELETE",
    [identifier, confirmText]
  );

  async function runRequest(dryRun: boolean) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const headers = getApiHeaders({ "Content-Type": "application/json" });
      const res = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          identifier: identifier.trim(),
          dry_run: dryRun,
          confirm: dryRun ? undefined : confirmText.trim(),
        }),
      });
      const json = (await res.json().catch(() => null)) as AdminDeleteResponse | null;
      if (!res.ok || !json) {
        setError(json?.error || "Anfrage fehlgeschlagen.");
        return;
      }
      if (!json.ok) {
        setError(json.error || "Vorgang fehlgeschlagen.");
      }
      setResult(json);
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-8 text-slate-400">Prüfe Berechtigung…</div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/30 p-6">
            <h1 className="text-lg font-semibold text-rose-200">Kein Zugriff</h1>
            <p className="mt-2 text-sm text-slate-300">
              Diese Seite ist nur für Administratoren verfügbar.
            </p>
            <Link href="/musterfall" className="mt-4 inline-block text-sm text-sky-300 hover:text-sky-200">
              Zurück zu Muster →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <div className="rounded-2xl border border-sky-800/60 bg-sky-950/30 p-5">
          <div className="text-sm font-medium text-sky-100">Admin-Werkzeuge</div>
          <p className="mt-1 text-sm text-sky-100/80">
            Hier findest du User-Management und Analytics.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/admin/user-management"
              className="rounded-lg border border-sky-700/70 bg-sky-900/30 px-3 py-3 text-sm text-sky-100 hover:bg-sky-900/50"
            >
              User-Management
              <div className="mt-1 text-xs text-sky-100/80">User inkl. Datenabhängigkeiten prüfen/löschen</div>
            </Link>
            <Link
              href="/admin/analytics"
              className="rounded-lg border border-sky-700/70 bg-sky-900/30 px-3 py-3 text-sm text-sky-100 hover:bg-sky-900/50"
            >
              Analytics
              <div className="mt-1 text-xs text-sky-100/80">KPI-Übersicht und Dashboard-Zugang</div>
            </Link>
          </div>
          <Link href="/musterfall" className="mt-4 inline-block text-sm text-sky-200 hover:text-sky-100">
            Zurück zu Muster →
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="text-xl font-semibold text-slate-100">Admin: User löschen</h1>
          <p className="mt-2 text-sm text-slate-400">
            Löscht einen User inklusive Silverline-Datenabhängigkeiten. Erst mit Dry-Run prüfen.
          </p>

          <div className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-sm text-slate-300">Zu löschender User (Dropdown)</label>
              <select
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-600"
                disabled={usersLoading || users.length === 0}
              >
                {users.length === 0 ? (
                  <option value="">Keine löschbaren User gefunden</option>
                ) : (
                  users.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name} ({u.login}) - {u.email} - ID {u.id}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={usersLoading || busy}
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs text-slate-100 disabled:opacity-50"
            >
              {usersLoading ? "Lade…" : "Aktualisieren"}
            </button>
          </div>

          <label className="mt-4 block text-sm text-slate-300">Bestätigung für Löschung</label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-rose-600"
            placeholder='Für Löschen "DELETE" eingeben'
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || identifier.trim().length === 0}
              onClick={() => void runRequest(true)}
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-2 text-sm text-slate-100 disabled:opacity-50"
            >
              {busy ? "…" : "Dry-Run prüfen"}
            </button>
            <button
              type="button"
              disabled={busy || !canDelete}
              onClick={() => void runRequest(false)}
              className="rounded-lg border border-rose-700 bg-rose-900/40 px-4 py-2 text-sm text-rose-100 disabled:opacity-50"
            >
              {busy ? "…" : "User + Daten löschen"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-2 text-sm font-medium text-slate-200">Antwort</div>
            <pre className="overflow-x-auto rounded border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
