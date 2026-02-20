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

export function useInstallPrompt() {
  const [platform] = useState<Platform>(detectPlatform);
  const [androidBrowser] = useState<AndroidBrowser>(detectAndroidBrowser);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [promptSettled, setPromptSettled] = useState(false);

  useEffect(() => {
    let gotPrompt = false;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      gotPrompt = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPromptSettled(true);
    }

    function onAppInstalled() {
      setJustInstalled(true);
      setDeferredPrompt(null);
      setPromptSettled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    const timer = setTimeout(() => {
      if (!gotPrompt) setPromptSettled(true);
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      setJustInstalled(true);
    }
    return outcome === "accepted";
  }, [deferredPrompt]);

  const likelyInstalled = promptSettled && !deferredPrompt && platform !== "ios";

  return {
    platform,
    androidBrowser,
    canPrompt: !!deferredPrompt,
    justInstalled,
    likelyInstalled,
    promptSettled,
    promptInstall,
  };
}
