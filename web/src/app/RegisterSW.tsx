"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js silently on mount. The SW exists only so Chrome shows
 * the "install" button in the URL bar (PWA installability criteria require
 * a registered service worker with a fetch handler).
 *
 * Registration intentionally happens after the page is interactive — never
 * blocks first paint.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Wait for load so we don't compete with main-thread work.
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          /* swallow — install button is a nice-to-have, not critical */
        });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
