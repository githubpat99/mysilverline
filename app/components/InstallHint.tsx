"use client";

import { useEffect, useState } from "react";

function isPWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export default function InstallHint({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!isPWA());
  }, []);

  if (!show) return null;
  return <>{children}</>;
}
