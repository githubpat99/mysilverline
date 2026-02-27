"use client";

declare global {
  interface Window {
    umami?: {
      track: (eventName?: string, data?: Record<string, string>) => void;
    };
  }
}

function canTrack(): boolean {
  return typeof window !== "undefined" && typeof window.umami?.track === "function";
}

export function trackEvent(eventName: string, props?: Record<string, string | number | boolean | null | undefined>) {
  if (!canTrack()) return;
  const normalizedProps: Record<string, string> = {};
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      normalizedProps[k] = String(v);
    }
  }
  window.umami?.track(eventName, Object.keys(normalizedProps).length ? normalizedProps : undefined);
}

export function trackPageview(url?: string) {
  if (!canTrack()) return;
  window.umami?.track("pageview", url ? { path: url } : undefined);
}
