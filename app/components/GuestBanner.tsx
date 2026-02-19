"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuthState, getLocalUserId } from "@/lib/services/authService";
import LoginDialog from "./LoginDialog";

export default function GuestBanner() {
  const [show, setShow] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const checkAuth = useCallback(() => {
    getAuthState().then(({ online, hasSession }) => {
      if (online && !hasSession && getLocalUserId()) {
        setShow(true);
      } else {
        setShow(false);
      }
    });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!show) return null;

  return (
    <>
      <div className="border-b border-amber-800/60 bg-amber-950/40 px-3 py-2 text-center text-sm text-amber-200">
        Du arbeitest offline als Gastbenutzer –{" "}
        <button
          onClick={() => setLoginOpen(true)}
          className="underline hover:text-amber-100"
        >
          melde dich an
        </button>
        , um deine Daten zu sichern.
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
