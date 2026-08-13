"use client";

import { useEffect } from "react";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * Registers the service worker (production) and marks standalone
 * iOS / Android home-screen sessions so CSS can match native chrome.
 */
export function PwaRegister() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle("pwa-standalone", isStandaloneDisplay());
    };
    apply();

    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", apply);

    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    }

    return () => media.removeEventListener("change", apply);
  }, []);

  return null;
}
