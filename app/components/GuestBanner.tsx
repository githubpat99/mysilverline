"use client";

import { useEffect, useState } from "react";
import { getAuthState, getLocalUserId } from "@/lib/services/authService";
import Link from "next/link";

export default function GuestBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    getAuthState().then(({ online, hasSession }) => {
      if (online && !hasSession && getLocalUserId()) {
        setShow(true);
      } else {
        setShow(false);
      }
    });
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-amber-800/60 bg-amber-950/40 px-3 py-2 text-center text-sm text-amber-200">
      Du arbeitest offline als Gastbenutzer –{" "}
      <Link
        href="https://mysilverline.it-pin.ch/login"
        className="underline hover:text-amber-100"
        target="_blank"
        rel="noopener noreferrer"
      >
        melde dich an
      </Link>
      , um deine Daten zu synchronisieren.
    </div>
  );
}
