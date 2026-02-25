"use client";

import { useState } from "react";
import { setAuthToken } from "@/lib/authTokenStorage";
import { SL_API_BASE } from "@/lib/config";
import { runSync } from "@/lib/services/syncService";

const API = SL_API_BASE || "/wp-json/silverline/v1";
const LOGIN_URL = `${API}/auth/login`;
const REGISTER_URL = `${API}/auth/register`;

type Mode = "login" | "register";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginDialog({ open, onClose }: LoginDialogProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const reset = () => {
    setError("");
    setUsername("");
    setEmail("");
    setPassword("");
  };

  const switchMode = (m: Mode) => {
    reset();
    setMode(m);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const isRegister = mode === "register";
    const url = isRegister ? REGISTER_URL : LOGIN_URL;
    const body = isRegister
      ? { username, email, password }
      : { username, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || (isRegister ? "Registrierung fehlgeschlagen." : "Login fehlgeschlagen."));
        setLoading(false);
        return;
      }

      const wpUserId = Number(json?.user?.user_id ?? 0) || undefined;
      setAuthToken(json.token, wpUserId);
      try {
        // On login we only pull server data; pushing local edits remains a manual Sync action.
        await runSync({ push: false });
      } catch {
        // Non-fatal: user can still continue and sync manually if needed.
      }
      onClose();
      window.location.reload();
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === "register";
  const canSubmit = isRegister
    ? username.length >= 3 && email.includes("@") && password.length >= 6
    : username !== "" && password !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        onSubmit={handleSubmit}
        className="mx-4 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
      >
        {/* Tabs */}
        <div className="mb-5 flex rounded-lg border border-slate-700 overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === "login"
                ? "bg-slate-800 text-white"
                : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === "register"
                ? "bg-slate-800 text-white"
                : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            Registrieren
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <label className="mb-1 block text-sm text-slate-300">
          Benutzername
        </label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan-500"
          autoFocus
        />

        {isRegister && (
          <>
            <label className="mb-1 block text-sm text-slate-300">
              E-Mail
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan-500"
            />
          </>
        )}

        <label className="mb-1 block text-sm text-slate-300">
          Passwort{isRegister ? " (min. 6 Zeichen)" : ""}
        </label>
        <input
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan-500"
        />

        {!canSubmit && isRegister && (username || email || password) && (
          <div className="mb-3 rounded bg-slate-800 px-3 py-2 text-xs text-slate-400">
            {username.length < 3 && "Benutzername min. 3 Zeichen. "}
            {!email.includes("@") && "Gültige E-Mail erforderlich. "}
            {password.length < 6 && "Passwort min. 6 Zeichen."}
          </div>
        )}
        <div className="mb-4 rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs leading-relaxed text-slate-400">
          Bei aktiver Synchronisation werden deine Daten gemäss aktuellem Hosting-Setup auf
          Servern in der Schweiz (Infomaniak) gespeichert.
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium text-white transition ${
              canSubmit && !loading
                ? "bg-cyan-600 hover:bg-cyan-500"
                : "bg-slate-700 cursor-not-allowed text-slate-500"
            }`}
          >
            {loading ? "..." : isRegister ? "Registrieren" : "Anmelden"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-slate-400 hover:text-white"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
