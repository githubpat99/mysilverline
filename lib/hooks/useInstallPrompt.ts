"use client";

import { useEffect, useState, useCallback } from "react";

export type Platform = "ios" | "android" | "desktop";
export type AndroidBrowser = "chrome" | "samsung" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function detectAndroidBrowser(): AndroidBrowser {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Chrome\/\d/i.test(ua) && !/EdgA/i.test(ua)) return "chrome";
  return "other";
}

const INSTALLED_KEY = "sl_pwa_installed";

function readInstalled(): boolean {
  try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return false; }
}

function writeInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* noop */ }
}

export function useInstallPrompt() {
  const [platform] = useState<Platform>(detectPlatform);
  const [androidBrowser] = useState<AndroidBrowser>(detectAndroidBrowser);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(readInstalled);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      writeInstalled();
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      writeInstalled();
      setInstalled(true);
    }
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    platform,
    androidBrowser,
    canPrompt: !!deferredPrompt,
    installed,
    promptInstall,
  };
}
