"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { whoAmI } from "@/lib/profileApi";
import LandingContent from "./LandingContent";

const AUTH_CHECK_TIMEOUT_MS = 2500;

export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      router.replace("/finance");
      return;
    }

    const timer = setTimeout(() => setChecked(true), AUTH_CHECK_TIMEOUT_MS);

    whoAmI().then((me) => {
      setChecked(true);
      if (me?.logged_in) {
        router.replace("/finance");
      }
    });

    return () => clearTimeout(timer);
  }, [router]);

  // Kurz prüfen (Token/Cookie) – bei Timeout oder fehlendem Login: Landing zeigen
  if (!checked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return <LandingContent />;
}
