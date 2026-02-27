"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_ENABLED } from "@/lib/config";
import { trackEvent, trackPageview } from "@/lib/analytics";

const APP_OPEN_KEY = "sl_analytics_app_open_sent";

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    if (typeof window === "undefined") return;

    if (!sessionStorage.getItem(APP_OPEN_KEY)) {
      trackEvent("app_open", { path: pathname || "/" });
      sessionStorage.setItem(APP_OPEN_KEY, "1");
    }
  }, [pathname]);

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    trackPageview(pathname || "/");
  }, [pathname]);

  return null;
}
